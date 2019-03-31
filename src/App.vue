<template>
  <div id="app" ref="app">
    <!-- <button class="btn">切换</button> -->
    <div class="webcam">
      <video
        class="webcam-video"
        ref="videoSrc"
        :width="videoWidth"
        :height="videoHeight"
        v-on:canplay="onSourceReady"
      >Your browser does not support this application.</video>
      <canvas ref="canvas" class="webcam-canvas" :width="videoWidth" :height="videoHeight"></canvas>
    </div>
    <p class="msg">{{msg}}</p>
  </div>
</template>

<script>
import Stats from 'stats.js'
import getUserMedia from 'getusermedia'

const publicPath = process.env.BASE_URL
let cv = null

export default {
  name: 'app',
  data() {
    return {
      videoWidth: 1920,
      videoHeight: 1080,
      stream: null,
      stats: null,
      canvasCtx: null,
      faceClassifier: null,
      detectMat: null,
      videoCap: null,
      faceVect: null,
      processTimer: null,
      msg: ''
    }
  },
  methods: {
    startCamera() {
      const constraints = {
        audio: false,
        video: {
          width: {
            facingMode: 'user',
            min: 960,
            ideal: 1280,
            max: 1920
          },
          height: {
            min: 540,
            ideal: 720,
            max: 1080
          }
        }
      }
      getUserMedia(constraints, (err, s) => {
        if (err) {
          this.setMsg('getUserMedia failed', 'warn')
          console.warn(err)
          return
        }
        this.setMsg('getUserMedia success')
        this.stream = s
        this.$refs.videoSrc.srcObject = s
        this.$refs.videoSrc.play()
      })
    },
    stopCamera() {
      if (!this.stream) return
      this.setMsg('stopCamera')
      this.stopVideoProcessing()
      this.$refs.videoSrc.pause()
      this.$refs.videoSrc.srcObject = null
      this.stream.getVideoTracks()[0].stop()
      this.stream = null
    },
    onSourceReady() {
      this.setMsg('onSourceReady.')
      this.videoWidth = this.$refs.videoSrc.videoWidth
      this.videoHeight = this.$refs.videoSrc.videoHeight
      console.log(this.videoWidth, this.videoHeight)
      if (window.Module) {
        cv = window.Module
        this.startVideoProcessing()
      } else {
        this.loadOpenCv()
      }
    },
    initStats() {
      this.stats = new Stats()
      this.stats.showPanel(0)
      this.$refs.app.appendChild(this.stats.dom)
    },
    loadOpenCv() {
      if (!window.WebAssembly) {
        this.setMsg("Your web browser doesn't support WebAssembly.", 'warn')
        return
      }
      this.setMsg('loading OpenCv.js')
      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.async = 'async'
      script.src = `${publicPath}libs/opencv.js`
      document.body.appendChild(script)
      script.onload = () => {
        this.setMsg('OpenCV.js is loaded.')
      }

      window.Module = {
        wasmBinaryFile: `${publicPath}libs/opencv_js.wasm`, // for wasm mode
        preRun: () => {
          this.setMsg('loading haarcascade_frontalface_default.xml')
          window.Module.FS_createPreloadedFile(
            '/',
            'haarcascade_frontalface',
            `${publicPath}data/haarcascade_frontalface_default.xml`,
            true,
            false
          )
        },
        _main: () => {
          this.setMsg('OpenCV.js is ready.')
          cv = window.cv
          // console.log(cv.getBuildInformation())
          this.startVideoProcessing()
        }
      }
    },

    startVideoProcessing() {
      this.setMsg('startVideoProcessing.')

      if (!this.stream) {
        this.setMsg('Please startup your webcam.', 'warn')
        return
      }
      this.canvasCtx = this.$refs.canvas.getContext('2d')
      this.faceClassifier = new cv.CascadeClassifier()
      this.faceClassifier.load('haarcascade_frontalface')
      this.srcMat = new cv.Mat(this.videoHeight, this.videoWidth, cv.CV_8UC4)
      this.detectMat = new cv.Mat()
      this.videoCap = new cv.VideoCapture(this.$refs.videoSrc)
      this.faceVect = new cv.RectVector()
      this.initStats()
      this.processTimer = requestAnimationFrame(this.processVideo)
    },

    stopVideoProcessing() {
      cancelAnimationFrame(this.processTimer)
      this.stats.end()
      if (this.faceClassifier && !this.faceClassifier.isDeleted()) {
        this.faceClassifier.delete()
      }
      this.srcMat.delete()
      this.detectMat.delete()
      this.faceVect.delete()
      this.canvasCtx.clearRect(0, 0, this.videoWidth, this.videoHeight)
    },

    processVideo() {
      if (!this.$refs.videoSrc) {
        this.setMsg('Video stream not found.', 'warn')
        return
      }
      this.stats.begin()
      this.videoCap.read(this.srcMat)
      cv.cvtColor(this.srcMat, this.detectMat, cv.COLOR_RGBA2GRAY, 0)
      cv.pyrDown(this.detectMat, this.detectMat)
      cv.pyrDown(this.detectMat, this.detectMat)
      this.faceClassifier.detectMultiScale(
        this.detectMat,
        this.faceVect,
        1.1,
        3,
        0
      )
      this.drawFace()
      this.stats.end()
      this.processTimer = requestAnimationFrame(this.processVideo)
    },

    drawFace() {
      this.canvasCtx.clearRect(0, 0, this.videoWidth, this.videoHeight)
      for (let i = 0; i < this.faceVect.size(); ++i) {
        const rect = this.faceVect.get(i)
        if (rect.width > 0 && rect.height > 0) {
          this.canvasCtx.lineWidth = 2
          this.canvasCtx.strokeStyle = 'red'
          this.canvasCtx.strokeRect(
            rect.x * 4,
            rect.y * 4,
            rect.width * 4,
            rect.height * 4
          )
        }
      }
    },
    setMsg(msg, type = 'log') {
      this.msg = msg
      console[type](msg)
    }
  },
  mounted() {
    this.startCamera()
  },
  beforeDestroy() {
    this.stopCamera()
  }
}
</script>

<style lang="less">
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  min-height: 100vh;
  display: flex;
  // flex-flow: column nowrap;
  justify-content: center;
  align-items: center;
}
.btn {
  margin: 20px;
  padding: 5px 20px;
}
.webcam {
  position: relative;
  width: 100%;
  transform: rotateY(180deg);
  &-video {
    display: block;
    width: 100%;
    height: auto;
  }
  &-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
  }
}
.msg {
  position: fixed;
  top: 0;
  right: 0;
  padding: 10px;
  text-align: right;
  background: rgba(255, 255, 255, 0.3);
  font-size: 20px;
}
</style>
