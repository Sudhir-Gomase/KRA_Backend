#!/usr/bin/env python3
"""
OKR Analytics Engine for HRMS+KRA System
Handles complex calculations, scoring, and chart data generation
"""
import sys
import json
import math
from datetime import datetime, timedelta
from collections import defaultdict

def calculate_okr_score(objectives):
    """Calculate weighted OKR score using Google's OKR methodology"""
    if not objectives:
        return 0.0
    
    total_weight = sum(o.get('weight', 1) for o in objectives)
    weighted_sum = sum(o.get('progress', 0) * o.get('weight', 1) for o in objectives)
    
    score = (weighted_sum / total_weight) if total_weight > 0 else 0
    return round(score, 2)

def calculate_kr_progress(kr_type, start_value, target_value, current_value, tracking_type='MORE_IS_BETTER'):
    """Calculate Key Result progress based on type and tracking method"""
    if kr_type == 'BOOLEAN':
        return 100.0 if current_value >= 1 else 0.0
    
    if kr_type == 'MILESTONE':
        return min(100.0, max(0.0, current_value))
    
    value_range = target_value - start_value
    if value_range == 0:
        return 100.0 if current_value >= target_value else 0.0
    
    if tracking_type == 'LESS_IS_BETTER':
        # E.g. Start 1000, Target 500, range = -500. Current 750.
        # (750 - 1000) / -500 = 50%
        progress = ((current_value - start_value) / value_range) * 100
        # Wait, if start 0 and target 100 (budget), and current is 50, you've used 50%.
        # Does LESS_IS_BETTER mean the goal completes at target, and exceeding it is bad?
        # Let's say: Target = 50, Start = 100. Range = -50.
        # Current = 80. (80 - 100) / -50 = -20 / -50 = 0.4 = 40%.
        
        # If Start = 0, Target = -10. Range = -10.
        progress = ((current_value - start_value) / value_range) * 100
    else:
        # MORE_IS_BETTER
        progress = ((current_value - start_value) / value_range) * 100
        
    return round(min(100.0, max(0.0, progress)), 2)

def get_health_status(progress, days_elapsed_pct):
    """Determine health status based on progress vs time elapsed"""
    expected = days_elapsed_pct * 100
    gap = expected - progress
    
    if progress >= 100:
        return 'COMPLETED'
    elif gap <= 0:
        return 'ON_TRACK'
    elif gap <= 15:
        return 'AT_RISK'
    elif gap <= 30:
        return 'BEHIND'
    else:
        return 'CRITICAL'

def generate_progress_chart_data(checkins):
    """Generate chart-ready data for progress over time"""
    if not checkins:
        return []
    
    chart_data = []
    for ci in checkins:
        chart_data.append({
            'date': ci.get('checkinDate', ''),
            'progress': round(ci.get('progress', 0), 1),
            'previousProgress': round(ci.get('previousProgress', 0), 1),
            'delta': round(ci.get('progress', 0) - ci.get('previousProgress', 0), 1)
        })
    
    return chart_data

def calculate_department_okr_scores(dept_data):
    """Rank departments by OKR performance"""
    dept_scores = []
    for dept in dept_data:
        objectives = dept.get('objectives', [])
        score = calculate_okr_score(objectives)
        dept_scores.append({
            'departmentId': dept.get('id'),
            'departmentName': dept.get('name'),
            'score': score,
            'totalObjectives': len(objectives),
            'completedObjectives': sum(1 for o in objectives if o.get('progress', 0) >= 100),
            'avgProgress': round(sum(o.get('progress', 0) for o in objectives) / max(len(objectives), 1), 1)
        })
    
    dept_scores.sort(key=lambda x: x['score'], reverse=True)
    for i, d in enumerate(dept_scores):
        d['rank'] = i + 1
    
    return dept_scores

def calculate_individual_scores(employee_data):
    """Calculate individual KRA scores with bell curve normalization"""
    if not employee_data:
        return []
    
    raw_scores = []
    for emp in employee_data:
        objectives = emp.get('objectives', [])
        raw_score = calculate_okr_score(objectives)
        raw_scores.append({
            'employeeId': emp.get('id'),
            'name': emp.get('name', ''),
            'rawScore': raw_score,
            'objectives': len(objectives)
        })
    
    if not raw_scores:
        return []
    
    # Bell curve normalization
    scores = [r['rawScore'] for r in raw_scores]
    mean = sum(scores) / len(scores)
    variance = sum((s - mean) ** 2 for s in scores) / max(len(scores), 1)
    std_dev = math.sqrt(variance)
    
    def get_rating_band(score):
        if score >= 90: return 'Exceptional'
        elif score >= 75: return 'Exceeds Expectations'
        elif score >= 60: return 'Meets Expectations'
        elif score >= 45: return 'Needs Improvement'
        else: return 'Below Expectations'
    
    result = []
    for r in raw_scores:
        z_score = (r['rawScore'] - mean) / max(std_dev, 1)
        result.append({
            **r,
            'normalizedScore': round(r['rawScore'], 1),
            'zScore': round(z_score, 2),
            'ratingBand': get_rating_band(r['rawScore'])
        })
    
    result.sort(key=lambda x: x['rawScore'], reverse=True)
    return result

def generate_heatmap_data(objectives_by_month):
    """Generate heatmap data for activity tracking"""
    heatmap = defaultdict(int)
    for month_data in objectives_by_month:
        date_key = month_data.get('month', '')
        heatmap[date_key] += month_data.get('updates', 0)
    
    return [{'date': k, 'value': v} for k, v in sorted(heatmap.items())]

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No input file provided'}))
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    try:
        with open(input_file, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(json.dumps({'error': f'Failed to read input: {str(e)}'}))
        sys.exit(1)
    
    operation = data.get('operation', 'overview')
    
    try:
        if operation == 'okr_score':
            result = {
                'score': calculate_okr_score(data.get('objectives', [])),
                'breakdown': [
                    {
                        'id': o.get('id'),
                        'title': o.get('title'),
                        'progress': o.get('progress', 0),
                        'weight': o.get('weight', 1),
                        'status': get_health_status(o.get('progress', 0), data.get('cycleCompletionPct', 0.5))
                    }
                    for o in data.get('objectives', [])
                ]
            }
        
        elif operation == 'department_ranking':
            result = {'departments': calculate_department_okr_scores(data.get('departments', []))}
        
        elif operation == 'individual_scores':
            result = {'employees': calculate_individual_scores(data.get('employees', []))}
        
        elif operation == 'progress_chart':
            result = {'chartData': generate_progress_chart_data(data.get('checkins', []))}
        
        elif operation == 'kr_progress':
            result = {
                'progress': calculate_kr_progress(
                    data.get('type', 'PERCENTAGE'),
                    data.get('startValue', 0),
                    data.get('targetValue', 100),
                    data.get('currentValue', 0),
                    data.get('trackingType', 'MORE_IS_BETTER')
                )
            }
        
        elif operation == 'health_status':
            result = {
                'status': get_health_status(
                    data.get('progress', 0),
                    data.get('daysElapsedPct', 0.5)
                )
            }
        
        else:
            result = {'error': f'Unknown operation: {operation}'}
        
        print(json.dumps(result))
    
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
