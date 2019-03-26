import Vue from "vue";
import App from "./App.vue";
import '@/assets/reset.css' // 全局样式文件

Vue.config.productionTip = false;

new Vue({
  render: h => h(App)
}).$mount("#app");
