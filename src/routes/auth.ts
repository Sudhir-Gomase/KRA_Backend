import { prisma } from '../db.js'
import bcrypt from 'bcryptjs'

export default async function authRoutes(app: any) {
  // Login
  app.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 }
        }
      }
    }
  }, async (request: any, reply: any) => {
    const { email, password } = request.body

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: { include: { role: true } },
        employee: {
          include: {
            department: true,
            position: true
          }
        },
        company: true
      }
    })

    console.info(`[LOGIN DEBUG] Attempt for email: ${email}`)

    if (!user) {
      console.warn(`[LOGIN DEBUG] User not found for email: ${email}`)
      return reply.code(401).send({ success: false, message: 'Invalid credentials' })
    }

    if (!user.isActive) {
      console.warn(`[LOGIN DEBUG] User found but is NOT active: ${email}`)
      return reply.code(401).send({ success: false, message: 'Invalid credentials' })
    }

    const validPass = await bcrypt.compare(password, user.password)
    if (!validPass) {
      console.warn(`[LOGIN DEBUG] User found but password check failed: ${email}`)
      return reply.code(401).send({ success: false, message: 'Invalid credentials' })
    }

    console.info(`[LOGIN DEBUG] Login successful for: ${email}`)

    const roles = user.userRoles.map(ur => ur.role.name)
    const token = app.jwt.sign({
      id: user.id,
      email: user.email,
      companyId: user.companyId,
      employeeId: user.employeeId,
      roles
    })

    const refreshToken = app.jwt.sign(
      { id: user.id, type: 'refresh' },
      { expiresIn: '7d', secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET }
    )

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    })

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    })

    return reply.send({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          roles,
          company: user.company,
          employee: user.employee
        }
      }
    })
  })

  // Get current user profile
  app.get('/me', { onRequest: [app.authenticate] }, async (request: any, reply: any) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      include: {
        userRoles: { include: { role: true } },
        employee: {
          include: {
            department: true,
            position: true,
            manager: { select: { id: true, firstName: true, lastName: true, avatar: true } }
          }
        },
        company: true
      }
    })

    if (!user) return reply.code(404).send({ success: false, message: 'User not found' })

    return reply.send({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        roles: user.userRoles.map(ur => ur.role.name),
        company: user.company,
        employee: user.employee
      }
    })
  })

  // Change password
  app.post('/change-password', { onRequest: [app.authenticate] }, async (request: any, reply: any) => {
    const { currentPassword, newPassword } = request.body

    const user: any = await prisma.user.findUnique({ where: { id: request.user.id } })
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return reply.code(400).send({ success: false, message: 'Current password is incorrect' })

    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: request.user.id }, data: { password: hashed } })

    return reply.send({ success: true, message: 'Password changed successfully' })
  })

  // Logout
  app.post('/logout', { onRequest: [app.authenticate] }, async (request: any, reply: any) => {
    await prisma.refreshToken.deleteMany({ where: { userId: request.user.id } })
    return reply.send({ success: true, message: 'Logged out successfully' })
  })
}
