import { createRouter, createWebHistory } from "vue-router";
import { authState, restoreSession } from "../auth/state.ts";

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
          component: () => import("../views/SchedulesPlaceholderView.vue"),
        },
        {
          path: "schedules/new",
          name: "schedules-new",
          meta: { operatorOnly: true },
          component: () => import("../views/SchedulesPlaceholderView.vue"),
        },
        {
          path: "schedules/:id",
          name: "schedules-detail",
          meta: { operatorOnly: true },
          component: () => import("../views/SchedulesPlaceholderView.vue"),
        },
        {
          path: "jobs",
          name: "jobs",
          component: () => import("../views/JobsPlaceholderView.vue"),
        },
        {
          path: "jobs/:id",
          name: "jobs-detail",
          component: () => import("../views/JobsPlaceholderView.vue"),
        },
        {
          path: "data",
          name: "data",
          component: () => import("../views/DataPlaceholderView.vue"),
        },
        {
          path: "data/:id",
          name: "data-detail",
          component: () => import("../views/DataPlaceholderView.vue"),
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  restoreSession();

  const isPublic = to.matched.some((r) => r.meta.public);
  const requiresAuth = to.matched.some((r) => r.meta.requiresAuth);
  const operatorOnly = to.matched.some((r) => r.meta.operatorOnly);

  if (isPublic) {
    if (authState.role != null && to.name === "login") {
      return { name: "dashboard" };
    }
    return true;
  }

  if (requiresAuth) {
    if (authState.role == null) {
      return {
        name: "login",
        query: { redirect: to.fullPath },
      };
    }
    if (operatorOnly && authState.role !== "operator") {
      return { name: "dashboard" };
    }
  }

  return true;
});

export { router };
