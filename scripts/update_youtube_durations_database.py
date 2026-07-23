#!/usr/bin/env python3
"""
סקריפט לעדכון duration_minutes ב-lesson_media_links במסד הנתונים ישירות
שולף את ה-duration מ-YouTube API ומעדכן את המסד הנתונים
"""
import os
import sys
from supabase import create_client, Client

# הוסף את התיקייה הראשית לנתיב
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
sys.path.insert(0, project_root)

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

def update_durations_in_database():
    """עדכן את duration_minutes ב-lesson_media_links במסד הנתונים"""
    # קבלת פרטי Supabase מהסביבה
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_ANON_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ שגיאה: SUPABASE_URL ו-SUPABASE_ANON_KEY חייבים להיות מוגדרים")
        print("הגדר אותם כך:")
        print("export SUPABASE_URL='your-url'")
        print("export SUPABASE_ANON_KEY='your-key'")
        return
    
    supabase: Client = create_client(supabase_url, supabase_key)
    
    # קבלת כל השיעורים של קורס ההכשרה
    response = supabase.table('lesson_media_links').select('*').eq('course_id', 'david-training-course').eq('is_active', True).execute()
    
    if not response.data:
        print("❌ לא נמצאו שיעורים")
        return
    
    videos = response.data
    print(f"נמצאו {len(videos)} שיעורים")
    print("משוך אורכים מה-YouTube...\n")
    
    updates = []
    for i, video in enumerate(videos, 1):
        youtube_id = video.get('youtube_id')
        if not youtube_id:
            continue
        
        lesson_id = video.get('lesson_id')
        current_duration = video.get('duration_minutes', 0)
        
        print(f"[{i}/{len(videos)}] משוך {youtube_id} (שיעור: {lesson_id})...", end=" ", flush=True)
        duration_seconds = get_video_duration_ytdlp(youtube_id)
        
        if duration_seconds:
            duration_minutes = round(duration_seconds / 60)
            if duration_minutes != current_duration:
                print(f"{duration_minutes} דקות (נוכחי: {current_duration}) ✓")
                updates.append({
                    'lesson_id': lesson_id,
                    'youtube_id': youtube_id,
                    'old_duration': current_duration,
                    'new_duration': duration_minutes
                })
            else:
                print(f"{duration_minutes} דקות (זהה) -")
        else:
            print("נכשל ✗")
    
    # עדכן את המסד הנתונים
    if updates:
        print(f"\nמעדכן {len(updates)} שיעורים במסד הנתונים...")
        
        for update in updates:
            try:
                result = supabase.table('lesson_media_links').update({
                    'duration_minutes': update['new_duration'],
                    'updated_at': 'now()'
                }).eq('course_id', 'david-training-course').eq('lesson_id', update['lesson_id']).execute()
                
                if result.data:
                    print(f"✅ עודכן שיעור {update['lesson_id']}: {update['old_duration']} -> {update['new_duration']} דקות")
                else:
                    print(f"⚠️ לא עודכן שיעור {update['lesson_id']}")
            except Exception as e:
                print(f"❌ שגיאה בעדכון שיעור {update['lesson_id']}: {e}")
        
        print(f"\n✅ עודכנו {len(updates)} שיעורים במסד הנתונים")
    else:
        print("\nלא נמצאו עדכונים נדרשים")

if __name__ == "__main__":
    import subprocess
    import json
    
    update_durations_in_database()



