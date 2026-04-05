import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth.ts";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/login",
      name: "login",
      component: () => import("../views/LoginView.vue"),
      meta: { public: true },
    },
    {
      path: "/",
      component: () => import("../layouts/AppLayout.vue"),
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          name: "home",
          redirect: { name: "dashboard" },
        },
        {
          path: "dashboard",
          name: "dashboard",
          component: () => import("../views/DashboardView.vue"),
        },
        {
          path: "schedules",
          name: "schedules",
          meta: { operatorOnly: true },
          component: () => import("../views/schedules/SchedulesListView.vue"),
        },
        {
          path: "schedules/new",
          name: "schedules-new",
          meta: { operatorOnly: true },
          component: () => import("../views/schedules/ScheduleWizardView.vue"),
        },
        {
          path: "schedules/:id",
          name: "schedules-detail",
          meta: { operatorOnly: true },
          component: () => import("../views/schedules/ScheduleDetailView.vue"),
        },
        {
          path: "jobs",
          name: "jobs",
          component: () => import("../views/jobs/JobsListView.vue"),
        },
        {
          path: "jobs/:id",
          name: "jobs-detail",
          component: () => import("../views/jobs/JobDetailView.vue"),
        },
        {
          path: "data",
          name: "data",
          component: () => import("../views/data/RawPayloadsListView.vue"),
        },
        {
          path: "data/:id",
          name: "data-detail",
          component: () => import("../views/data/RawPayloadDetailView.vue"),
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  auth.restoreFromStorage();

  const isPublic = to.matched.some((r) => r.meta.public);
  const requiresAuth = to.matched.some((r) => r.meta.requiresAuth);
  const operatorOnly = to.matched.some((r) => r.meta.operatorOnly);

  if (isPublic) {
    if (auth.role != null && to.name === "login") {
      return { name: "dashboard" };
    }
    return true;
  }

  if (requiresAuth) {
    if (auth.role == null) {
      return {
        name: "login",
        query: { redirect: to.fullPath },
      };
    }
    if (operatorOnly && auth.role !== "operator") {
      return { name: "dashboard" };
    }
  }

  return true;
});

export { router };
