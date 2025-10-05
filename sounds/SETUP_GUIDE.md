# Step-by-Step Guide: Creating Your Custom Alert Sounds

This guide will walk you through creating all 5 custom alert sounds for your Pomodoro Timer using **100% FREE** tools with **NO signup required**.

---

## 🎯 What You'll Create

1. **Short Break Alert**: Gong + "Take a break" voice
2. **Long Break Alert**: Gong + "Take a break" voice
3. **Work Start Alert**: Gong + "Start workout session" voice
4. **Task Complete Alert**: Clapping sounds
5. **Daily Reset Alert**: No sound (disabled by default)

---

## 📥 STEP 1: Download Sound Effects

### Download a Gong Sound

**Recommended: Pixabay** (No signup required, no attribution needed)

1. Go to: https://pixabay.com/sound-effects/search/gong/
2. Browse and listen to different gong sounds
3. **Recommended**: Look for a clear, short gong (1-2 seconds)
4. Click the **Download** button (MP3 format)
5. Save as `gong.mp3` in your Downloads folder

**Alternative sources:**
- **Orange Free Sounds**: https://orangefreesounds.com/gong-sound/
  - Direct download, no signup
- **SoundBible**: https://soundbible.com/tags-gong.html
  - Multiple gong options

### Download Clapping/Applause Sound

**Recommended: Pixabay** (No signup required)

1. Go to: https://pixabay.com/sound-effects/search/applause/
2. Look for **short applause** or **clapping** (2-3 seconds)
3. **Recommended**: "small-applause" or "light-clapping"
4. Click **Download** (MP3)
5. Save as `applause.mp3` in your Downloads folder

**Alternative sources:**
- **Mixkit**: https://mixkit.co/free-sound-effects/clapping/
  - 14 free clapping sounds
- **Freesound** (requires free account): https://freesound.org/

---

## 🗣️ STEP 2: Create Voice Files Using Text-to-Speech

### For "Take a break" voice:

**Using TTSMaker** (No signup, unlimited, free)

1. Go to: https://ttsmaker.com/
2. In the text box, type: **"Take a break"**
3. Select language: **English**
4. Choose a voice: **Try "Google US English (Female)" or "Microsoft - Jenny Neural"**
5. Adjust speed if needed (Normal is usually good)
6. Click **"Convert to speech"**
7. Click **"Download MP3"**
8. Save as `take-a-break.mp3`

### For "Start workout session" voice:

1. Stay on https://ttsmaker.com/
2. Clear the text box
3. Type: **"Start workout session"**
4. Use the same voice as before for consistency
5. Click **"Convert to speech"**
6. Click **"Download MP3"**
7. Save as `start-workout.mp3`

**Alternative TTS Services** (all free, no signup):
- **Text2Speech**: https://www.text2speech.org/
- **TTSFree**: https://ttsfree.com/
- **Luvvoice**: https://luvvoice.com/ (200+ voices)

---

## 🎵 STEP 3: Combine Gong + Voice

**Using Audio Joiner** (No signup, free online tool)

### Create: short-break.mp3

1. Go to: https://audio-joiner.com/
2. Click **"Add tracks"**
3. Select these files in order:
   - First: `gong.mp3`
   - Second: `take-a-break.mp3`
4. Adjust the gap between files (0.2 seconds works well)
5. Make sure **"Crossfade"** is OFF (or very short - 0.1s)
6. Select output format: **MP3**
7. Click **"Join"**
8. Download and save as: `short-break.mp3`
9. Move to: `/home/rodrigotanco/Documents/clase/sounds/`

### Create: long-break.mp3

1. Refresh https://audio-joiner.com/
2. Click **"Add tracks"**
3. Select:
   - First: `gong.mp3`
   - Second: `take-a-break.mp3`
4. Click **"Join"**
5. Download and save as: `long-break.mp3`
6. Move to: `/home/rodrigotanco/Documents/clase/sounds/`

**Note**: Same as short-break, but you can use a different gong or voice variation if you want

### Create: work-start.mp3

1. Refresh https://audio-joiner.com/
2. Click **"Add tracks"**
3. Select:
   - First: `gong.mp3`
   - Second: `start-workout.mp3`
4. Click **"Join"**
5. Download and save as: `work-start.mp3`
6. Move to: `/home/rodrigotanco/Documents/clase/sounds/`

**Alternative Audio Combining Tools:**
- **Audio Trimmer**: https://audiotrimmer.com/audio-joiner/
- **Clideo**: https://clideo.com/merge-audio (3 files free per day)
- **TwistedWave Online**: https://twistedwave.com/online (free, simple)

---

## ✂️ STEP 4: Finalize Remaining Sounds

### Create: task-complete.mp3

This one is easy - just use your downloaded applause file!

1. Take the `applause.mp3` you downloaded from Pixabay
2. **Optional**: Trim it to 2-3 seconds if it's too long
   - Use: https://mp3cut.net/ (no signup needed)
   - Upload the file
   - Select the best 2-3 second section
   - Download
3. Rename to: `task-complete.mp3`
4. Move to: `/home/rodrigotanco/Documents/clase/sounds/`

### daily-reset.mp3 - Not Needed!

**The daily reset alert is disabled by default** - no sound file needed.

If you want to enable it later, you can upload a custom sound through the Settings panel in the app.

---

## 📋 STEP 5: Verify Your Files

After completing all steps, your `sounds/` directory should contain:

```
/home/rodrigotanco/Documents/clase/sounds/
├── short-break.mp3      ✓ (Gong + "Take a break")
├── long-break.mp3       ✓ (Gong + "Take a break")
├── work-start.mp3       ✓ (Gong + "Start workout session")
├── task-complete.mp3    ✓ (Applause/clapping)
├── README.md
├── SETUP_GUIDE.md
└── QUICK_LINKS.md
```

**Note**: No `daily-reset.mp3` needed - this alert is disabled by default.

---

## 🧪 STEP 6: Test in Your Application

1. Open your Pomodoro Timer application (`index.html`)
2. Go to **Settings** → **Alert Sounds**
3. For each sound type, you should now see the description:
   - Short Break: "Gong + Take a break"
   - Long Break: "Gong + Take a break"
   - Work Start: "Gong + Start workout session"
   - Task Complete: "Clapping sounds"
4. Click the **"Test"** button for each to preview
5. Adjust volume/duration as needed

---

## ⏱️ Estimated Time

- **Total time**: 15-20 minutes
- Step 1 (Download sounds): 5 minutes
- Step 2 (Create TTS voices): 3 minutes
- Step 3 (Combine audio): 7 minutes
- Step 4 (Finalize): 3 minutes
- Step 5 (Test): 2 minutes

---

## 🔧 Troubleshooting

### Sound not playing?
- Check browser console (F12) for errors
- Verify file is in MP3 format
- Ensure filename matches exactly (case-sensitive)
- Try refreshing the page (Ctrl+F5)

### File too large?
- Maximum size: 5MB per file
- Use https://www.freeconvert.com/mp3-compressor to reduce size
- Reduce bitrate to 128 kbps

### Sound cuts off or loops weirdly?
- Check the duration setting in the app
- Adjust "Duration (s)" for that alert type
- Ensure your audio file ends cleanly (no abrupt cut)

### Want to re-record voice?
- Just go back to TTSMaker
- Try different voices for variety
- Experiment with speed/pitch settings

---

## 💡 Pro Tips

1. **Keep it short**: 3-5 seconds is ideal for alerts
2. **Test volume**: Record at a consistent volume level
3. **Export quality**: Use 128-192 kbps for MP3 (good balance of quality/size)
4. **Backup**: Keep your source files (gong, voices) in case you want to remix later
5. **Variations**: Create multiple versions and swap them out to keep things fresh

---

## 🎨 Customization Ideas

- **Different voices**: Try male/female, different accents
- **Multiple gongs**: Use different gong sounds for work vs break
- **Add music**: Brief uplifting music snippet for long breaks
- **Personal touch**: Record your own voice instead of TTS
- **Themed sets**: Create morning/evening versions with different energy levels

---

## ✅ You're Done!

Once all files are in place, your Pomodoro Timer will automatically use these custom sounds. Users can still upload their own custom sounds if they prefer, but yours will be the high-quality defaults!

Enjoy your personalized Pomodoro Timer! 🍅⏰
