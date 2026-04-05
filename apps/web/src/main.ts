import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin, QueryClient } from "@tanstack/vue-query";
import "./assets/main.css";
import App from "./App.vue";
import { router } from "./router/index.ts";

const app = createApp(App);
const pinia = createPinia();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
    },
  },
});

app.use(pinia);
app.use(VueQueryPlugin, { queryClient });
app.use(router);
app.mount("#app");
