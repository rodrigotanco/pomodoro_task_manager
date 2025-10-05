# Pomodoro Timer - Default Alert Sounds

This directory contains the default alert sounds for different timer events. Each sound file is designed to match the specific context of the alert.

## Required Sound Files

### 1. `short-break.mp3`
- **Description**: Gong sound followed by a voice saying "Take a break"
- **Duration**: 3-5 seconds recommended
- **Use case**: Played when a work session ends and it's time for a short break

### 2. `long-break.mp3`
- **Description**: Gong sound followed by a voice saying "Take a break"
- **Duration**: 3-5 seconds recommended
- **Use case**: Played when a work session ends and it's time for a long break (after completing the configured number of pomodoros)

### 3. `work-start.mp3`
- **Description**: Gong sound followed by a voice saying "Start workout session"
- **Duration**: 3-5 seconds recommended
- **Use case**: Played when a break ends and it's time to start working again

### 4. `task-complete.mp3`
- **Description**: Clapping or applause sounds
- **Duration**: 2-3 seconds recommended
- **Use case**: Played when a task is marked as complete

### 5. `daily-reset.mp3` (optional)
- **Description**: Simple notification sound
- **Duration**: 2-3 seconds recommended
- **Use case**: Played when daily stats are reset

## How to Create These Sound Files

### Option 1: Use Text-to-Speech (TTS) Services

You can create custom voice alerts using free TTS services:

1. **Google Cloud Text-to-Speech** (https://cloud.google.com/text-to-speech)
   - Offers natural-sounding voices
   - Free tier available
   - Can export as MP3

2. **Amazon Polly** (https://aws.amazon.com/polly)
   - High-quality neural voices
   - Free tier includes 5 million characters per month

3. **TTSMaker** (https://ttsmaker.com)
   - Free online TTS tool
   - No registration required
   - Direct MP3 download

4. **Natural Readers** (https://www.naturalreaders.com/online/)
   - Free online tool
   - Multiple voice options

### Option 2: Record Your Own Voice

1. Use your phone's voice recorder or computer microphone
2. Record the phrases clearly
3. Add a gong sound at the beginning (download from royalty-free sources)
4. Use free audio editing software like:
   - **Audacity** (https://www.audacityteam.org/) - Desktop
   - **WavePad** - Desktop/Mobile
   - **Online Audio Editor** (https://www.onlineaudioconverter.com/)

### Option 3: Use Royalty-Free Sound Libraries

Download pre-made sounds from these free, royalty-free sources:

1. **Freesound** (https://freesound.org/)
   - Search for: "gong", "bell", "clapping", "applause"
   - Requires free account

2. **Zapsplat** (https://www.zapsplat.com/)
   - Large library of free sound effects
   - Simple registration required

3. **Pixabay** (https://pixabay.com/sound-effects/)
   - No attribution required
   - Free to use

4. **YouTube Audio Library** (https://www.youtube.com/audiolibrary)
   - Free sound effects
   - No attribution required for many sounds

## Combining Sounds

To create the gong + voice combinations:

### Using Audacity (Free):
1. Import the gong sound
2. Import or record the voice clip
3. Place the voice clip right after the gong
4. Export as MP3 (you may need to install the LAME encoder)

### Using Online Tools:
- **Audio Joiner** (https://audio-joiner.com/)
  - Drag and drop multiple files
  - Adjust the order
  - Export as MP3

## File Specifications

- **Format**: MP3 (recommended for best browser compatibility)
- **Sample Rate**: 44.1 kHz or 48 kHz
- **Bit Rate**: 128 kbps or higher
- **Channels**: Stereo or Mono
- **Maximum File Size**: 5 MB per file (enforced by the app)

## Installation

1. Place your sound files in this directory (`sounds/`)
2. Make sure the filenames match exactly:
   - `short-break.mp3`
   - `long-break.mp3`
   - `work-start.mp3`
   - `task-complete.mp3`
   - `daily-reset.mp3`
3. Refresh the Pomodoro Timer application
4. The sounds will automatically be used as defaults

## Testing

After adding your sound files:
1. Open the Pomodoro Timer application
2. Go to Settings > Alert Sounds
3. Click the "Test" button for each sound type to preview
4. Adjust volume and duration as needed

## Fallback Behavior

If a sound file is missing or fails to load:
- The app will fall back to the generic built-in alarm sound
- No errors will be shown to the user
- The timer will continue to function normally

## Need Help?

If you need assistance:
1. Check browser console for any audio loading errors
2. Verify file names match exactly (case-sensitive)
3. Ensure files are in MP3 format
4. Check that files are under 5 MB each
5. Test files in a media player to ensure they're not corrupted
