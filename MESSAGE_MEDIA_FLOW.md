# זרימת הודעות ומדיה – מערכת הצ'אט

## סקירה כללית

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        ChatGroupScreen (מסך צ'אט)                        │
│  handleSendMessage ← נקרא מכל סוגי השליחה (טקסט, מדיה, הקלטה, סקר)       │
└───────────────────────────────────────────┬─────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ChatContext.sendMessage()                             │
│  • הוספת הודעה אופטימיסטית מיידית                                        │
│  • שליחה ל-chatMessageService                                            │
│  • החלפה בהודעה אמיתית / סימון שגיאה / offline queue                    │
└───────────────────────────────────────────┬─────────────────────────────┘
                                             │
                                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              chatMessageService.sendChatMessage()                        │
│  • INSERT ל-chat_messages                                                │
│  • Realtime מפיץ לכל המנויים                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. שליחת הודעות טקסט

| שלב | קומפוננטה | פעולה |
|-----|------------|--------|
| 1 | **ChatInput** | `handleSend()` – קלט טקסט + mentions |
| 2 | | `onSendMessage(text, undefined, undefined, { mentioned_users, mentions })` |
| 3 | **ChatGroupScreen** | `handleSendMessage` → `sendMessage(input)` |
| 4 | **ChatContext** | `sendMessage` – יוצר `tempId`, מוסיף הודעה אופטימיסטית |
| 5 | | `chatMessageService.sendChatMessage()` |
| 6 | | מצליח → מחליף אופטימיסטי בהודעה אמיתית |
| 7 | | נכשל → מעדכן `send_error` על האופטימיסטי / מכניס ל-offline queue |

---

## 2. שליחת מדיה (תמונה, וידאו, אודיו)

| שלב | קומפוננטה | פעולה |
|-----|------------|--------|
| 1 | **ChatInput** | `MediaPickerSheet` – בחירת מקור (מצלמה/גלריה/וידאו/מסמך/הקלטה) |
| 2 | | `handleTakePhoto` / `handlePickImage` / `handlePickVideo` וכו' |
| 3 | | `setSelectedMedia()` → `setShowMediaPreview(true)` |
| 4 | **MediaPreviewModal** | תצוגה מקדימה, הוספת caption, שליחה |
| 5 | | `onSend(mediaFiles, captions)` → `handleSendMedia` |
| 6 | **ChatInput** | `addOptimisticMediaMessage()` – הודעה עם `local_media_uri`, `upload_progress: 0` |
| 7 | | `chatMediaService.uploadImage/uploadVideo()` – עם `onProgress` |
| 8 | | `updateOptimisticMessage(tempId, { upload_progress })` |
| 9 | | העלאה הושלמה → `updateOptimisticMessage(media_url)` + `onSendMessage(..., { existing_optimistic_id: tempId })` |
| 10 | **ChatContext** | `sendMessage` – מעדכן את ההודעה הקיימת (לא מוסיף חדשה) |
| 11 | | מצליח → מחליף בהודעה אמיתית |

**יושם:** עדכון במקום remove+add – מונע flicker, זרימה חלקה.

---

## 3. הקלטת אודיו

| שלב | קומפוננטה | פעולה |
|-----|------------|--------|
| 1 | **ChatInput** | `handleStartAudioRecording` ← `MediaPickerSheet` → `onAudio` |
| 2 | | `startRecording()` – expo-av, waveform, timer |
| 3 | | `stopRecording()` → `setRecordedAudioUri` |
| 4 | | `sendRecordedAudio()` – העלאה + `onSendMessage` עם `waveformData` |
| 5 | | **ללא** `addOptimisticMediaMessage` – ההודעה מתווספת רק ב-sendMessage |

---

## 4. סקרים (Poll)

| שלב | קומפוננטה | פעולה |
|-----|------------|--------|
| 1 | **ChatInput** | `MediaPickerSheet` → `onPoll` → `handleCreatePoll` |
| 2 | | `PollCreationBottomSheet` נפתח |
| 3 | **PollCreationBottomSheet** | `PollService.createPoll()` – יוצר polls + `createPollMessage` |
| 4 | | `createPollMessage` – INSERT ל-`chat_messages` עם `message_type: POLL` |
| 5 | | `onPollCreated(poll)` → `handlePollCreated` ב-ChatInput |
| 6 | **ChatInput** | `setPollCreationVisible(false)` – סגירת ה-sheet |
| 7 | **ChatContext** | Realtime מזהה הודעה חדשה → מוסיף לרשימה |

**הערה:** הסקר מופיע בצ'אט דרך Realtime, ללא הודעה אופטימיסטית. ניתן להוסיף אופטימיסטי לשיפור זמן תגובה.

---

## 5. Realtime ו-Dedup

| אירוע | ChatContext | פעולה |
|-------|-------------|--------|
| הודעה חדשה מ-Realtime | `subscribeToGroup` callback | אם `processedMessageIds` מכיל – דילוג |
| | | אחרת – `setMessages(prev => [msg, ...prev])` |
| חיבור מחדש | `onConnectionStatusChange` | `setIsConnected` |
| Offline queue | כש-`isConnected` חוזר | שליחה חוזרת של הודעות מהתור |

---

## 6. פונקציות אופטימיסטיות (ChatContext)

| פונקציה | שימוש |
|---------|--------|
| `addOptimisticMediaMessage(msg)` | מדיה – הודעה עם `local_media_uri` לפני העלאה |
| `updateOptimisticMessage(tempId, updates)` | עדכון `upload_progress`, `send_error` וכו' |
| `removeOptimisticMessage(tempId)` | הסרת הודעה אופטימיסטית (לפני קריאה ל-sendMessage) |

---

## 7. רשימת קומפוננטות מעורבות

| קומפוננטה | תפקיד |
|-----------|--------|
| **ChatInput** | קלט, MediaPickerSheet, MediaPreviewModal, PollCreationBottomSheet |
| **MediaPickerSheet** | בחירת סוג מדיה (מצלמה, גלריה, וידאו, מסמך, אודיו, סקר) |
| **MediaPreviewModal** | תצוגה מקדימה, caption, שליחה |
| **ChatGroupScreen** | `handleSendMessage` – גשר בין ChatInput ל-ChatContext |
| **ChatContext** | `sendMessage`, אופטימיסטי, offline queue, Realtime |
| **chatMessageService** | INSERT ל-chat_messages |
| **chatMediaService** | העלאת קבצים ל-Storage |

---

## 8. שיפורים מומלצים

1. **מדיה – המשכיות אופטימיסטית:** לעדכן את ההודעה האופטימיסטית ב-`media_url` במקום `removeOptimistic` + `sendMessage` (למנוע קפיצה).
2. **סקר – אופטימיסטי:** להוסיף הודעה אופטימיסטית כש-Poll נוצר, להתאים ל-Realtime.
3. **Documents:** לוודא ש-`handlePickDocument` עובר את כל השלבים עד `sendMessage`.
4. **מסד נתונים:** מעבר ל-`created_at` מהשרת (לא מהלקוח) ב-INSERT.
