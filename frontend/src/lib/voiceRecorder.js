// Voice recording utility using MediaRecorder API

export class VoiceRecorder {
  constructor() {
    this.mediaRecorder = null
    this.audioChunks = []
    this.isRecording = false
    this.startTime = null
    this.onStopCallback = null
    this.onErrorCallback = null
  }

  async startRecording(onStop, onError) {
    try {
      this.onStopCallback = onStop
      this.onErrorCallback = onError
      this.audioChunks = []
      this.startTime = Date.now()

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.stream = stream
      this.mediaRecorder = new MediaRecorder(stream)

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data)
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' })
        const duration = (Date.now() - this.startTime) / 1000
        // If onStopCallback was cleared (cancel), do not call it
        if (this.onStopCallback) {
          this.convertBlobToBase64(audioBlob, duration)
        }
        // Stop the stream
        if (this.stream) this.stream.getTracks().forEach(track => track.stop())
        this.stream = null
      }

      this.mediaRecorder.start()
      this.isRecording = true
    } catch (error) {
      console.error('Error accessing microphone:', error)
      if (this.onErrorCallback) {
        this.onErrorCallback(error.message)
      }
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop()
      this.isRecording = false
    }
  }

  // Cancel recording and discard captured audio
  cancelRecording() {
    // Clear the onStop callback so onstop handler will not trigger send
    this.onStopCallback = null
    if (this.mediaRecorder && this.isRecording) {
      try {
        this.mediaRecorder.stop()
      } catch (e) {
        // ignore
      }
      this.isRecording = false
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
    this.audioChunks = []
    this.startTime = null
  }

  convertBlobToBase64(blob, duration) {
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64data = reader.result
      if (this.onStopCallback) {
        this.onStopCallback({
          voiceData: base64data,
          voiceDuration: duration,
          blob: blob,
        })
      }
    }
    reader.readAsDataURL(blob)
  }

  isCurrentlyRecording() {
    return this.isRecording
  }

  getCurrentDuration() {
    if (!this.isRecording) return 0
    return ((Date.now() - this.startTime) / 1000).toFixed(1)
  }
}

export const voiceRecorder = new VoiceRecorder()
