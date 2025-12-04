#!/usr/bin/env python3
"""
סקריפט לשליפת אורך סרטוני YouTube מה-SQL file ועדכון הקובץ
"""
import re
import subprocess
import json
import sys

def get_video_duration_ytdlp(video_id):
    """משוך אורך סרטון באמצעות yt-dlp"""
    try:
        url = f"https://www.youtube.com/watch?v={video_id}"
        # נסה עם yt-dlp ישירות, ואם לא אז עם python3 -m yt_dlp
        for cmd_base in [["yt-dlp"], ["python3", "-m", "yt_dlp"]]:
            try:
                cmd = cmd_base + ["--dump-json", "--no-playlist", url]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                if result.returncode == 0:
                    data = json.loads(result.stdout)
                    duration = data.get('duration', 0)
                    return duration  # בשניות
            except FileNotFoundError:
                continue
        return None
    except Exception as e:
        print(f"Error getting duration for {video_id}: {e}", file=sys.stderr)
        return None

def parse_sql_file(file_path):
    """קרא את קובץ ה-SQL ומצא את כל ה-youtube_id ו-duration_minutes"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # מצא את כל ה-INSERT statements עם youtube_id ב-lesson_media_links
    # הפורמט: VALUES ('course_id', 'lesson_id', 'youtube_id', 'youtube_url', 'thumbnail_url', 'title', 'description', duration_minutes, is_active)
    pattern = r"INSERT INTO lesson_media_links[^V]*VALUES\s*\([^)]*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),"
    matches = re.finditer(pattern, content, re.MULTILINE | re.DOTALL)
    
    videos = []
    for match in matches:
        groups = match.groups()
        if len(groups) >= 8:
            lesson_id = groups[1]  # האינדקס השני הוא lesson_id
            youtube_id = groups[2]  # האינדקס השלישי הוא youtube_id
            current_duration = int(groups[7])  # האינדקס האחרון הוא duration_minutes
            if youtube_id and youtube_id != 'NULL':
                videos.append({
                    'lesson_id': lesson_id,
                    'youtube_id': youtube_id,
                    'current_duration': current_duration,
                    'match_start': match.start(),
                    'match_end': match.end()
                })
    
    return videos, content

def update_durations(file_path):
    """עדכן את אורכי הסרטונים בקובץ"""
    videos, content = parse_sql_file(file_path)
    
    print(f"נמצאו {len(videos)} סרטונים")
    print("משוך אורכים מה-YouTube...\n")
    
    updates = []
    for i, video in enumerate(videos, 1):
        video_id = video['youtube_id']
        if not video_id or video_id == 'NULL':
            continue
            
        print(f"[{i}/{len(videos)}] משוך {video_id}...", end=" ", flush=True)
        duration_seconds = get_video_duration_ytdlp(video_id)
        
        if duration_seconds:
            duration_minutes = round(duration_seconds / 60)
            old_duration = video['current_duration']
            if duration_minutes != old_duration:
                print(f"{duration_minutes} דקות (נוכחי: {old_duration}) ✓")
                updates.append({
                    'lesson_id': video['lesson_id'],
                    'video_id': video_id,
                    'old_duration': old_duration,
                    'new_duration': duration_minutes
                })
            else:
                print(f"{duration_minutes} דקות (זהה) -")
        else:
            print("נכשל ✗")
    
    # עדכן את הקובץ
    if updates:
        print(f"\nמעדכן {len(updates)} סרטונים בקובץ...")
        
        # שמור גיבוי קודם
        backup_path = file_path + ".backup"
        with open(backup_path, 'w', encoding='utf-8') as f:
            with open(file_path, 'r', encoding='utf-8') as original:
                f.write(original.read())
        print(f"גיבוי נשמר ב-{backup_path}")
        
        # עדכן כל video_id ב-lesson_media_links
        for update in updates:
            # מצא את כל המופעים של ה-video_id הזה ב-VALUES statements ועדכן את ה-duration
            # הפורמט: VALUES (..., 'youtube_id', ..., duration_minutes, ...)
            pattern = rf"INSERT INTO lesson_media_links[^V]*VALUES\s*\([^)]*'{re.escape(update['video_id'])}'[^)]*,\s*{update['old_duration']},"
            def replace_duration(match):
                return match.group(0).replace(f", {update['old_duration']},", f", {update['new_duration']},")
            content = re.sub(pattern, replace_duration, content)
        
        # עדכן גם את lessons לפי lesson_id
        for update in updates:
            # מצא את ה-lesson_id ב-lessons ועדכן את ה-duration_minutes
            # הפורמט: VALUES ('lesson_id', ..., duration_minutes, ...)
            pattern = rf"INSERT INTO lessons[^V]*VALUES\s*\([^)]*'{re.escape(update['lesson_id'])}'[^)]*,\s*{update['old_duration']},"
            def replace_lesson_duration(match):
                return match.group(0).replace(f", {update['old_duration']},", f", {update['new_duration']},")
            content = re.sub(pattern, replace_lesson_duration, content)
        
        # שמור את הקובץ המעודכן
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"עודכנו {len(updates)} סרטונים בקובץ {file_path}")
    else:
        print("\nלא נמצאו עדכונים נדרשים")

if __name__ == "__main__":
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    sql_file = os.path.join(project_root, "create_david_training_course.sql")
    
    if len(sys.argv) > 1:
        sql_file = sys.argv[1]
    
    update_durations(sql_file)

