<template>
  <div
    class="q-pa-md relative-position"
    style="height: 280px; max-height: 80vh"
  >
    <q-btn
      v-morph:btn:mygroup:300.resize="morphGroupModel"
      class="q-mt-md q-mb-md q-mr-md fixed-bottom-right"
      fab
      icon="help_outline"
      size="md"
      color="grey-8"
      text-color="white"
      @click="nextMorph"
    />

    <q-card
      v-if="morphGroupModel === 'card1'"
      v-morph:card1:mygroup:500.resize="morphGroupModel"
      class="fixed-bottom-right q-ma-md bg-grey-8 text-white"
      style="width: 300px; border-bottom-left-radius: 2em"
    >
      <q-card-section class="text-h6" style="padding: 10px 15px 0px 15px">
        {{ currentTip.title }}
      </q-card-section>

      <q-card-section class="text-subtitle1" style="padding: 0px 15px 0px 15px">
        <div v-if="Array.isArray(currentTip.body) || currentTip.list">
          <template v-if="Array.isArray(currentTip.body)">
            <template
              v-for="(part, idx) in currentTip.body"
              :key="'body-' + idx"
            >
              <q-icon
                v-if="part.icon"
                :name="part.icon"
                :color="part.color"
                :size="part.size || 'sm'"
                class="q-ma-xs"
              />
              <q-btn
                v-else-if="part.btn"
                round
                :size="part.size || 'sm'"
                :icon="part.icon"
                :color="part.color"
                class="q-ma-xs"
              />
              <NuxtLink
                v-else-if="part.link"
                :to="part.link"
                :class="part.class || 'text-primary'"
                :style="part.style || 'text-decoration: underline;'"
              >
                {{ part.text }}
              </NuxtLink>
              <span v-else-if="part.text" v-html="part.text"></span>
              <span v-else>{{ part }}</span>
            </template>
          </template>
          <ul v-if="currentTip.list" style="margin: 0 0 0 1em; padding: 0">
            <li
              v-for="(item, idx) in currentTip.list"
              :key="'list-' + idx"
              style="
                list-style: none;
                margin-bottom: 0.25em;
                display: flex;
                align-items: center;
              "
            >
              <q-icon
                v-if="item.icon"
                :name="item.icon"
                :color="item.color"
                :size="item.size || 'sm'"
                class="q-ma-xs"
              />
              <q-btn
                v-else-if="item.btn"
                round
                :size="item.size || 'sm'"
                :icon="item.icon"
                :color="item.color"
                class="q-ma-xs"
              />
              <span
                v-if="item.text"
                v-html="item.text"
                style="margin-left: 0.25em"
              ></span>
            </li>
          </ul>
        </div>
        <div v-else-if="currentTip.body">
          <template
            v-for="(part, idx) in currentTip.body"
            :key="'bodypart-' + idx"
          >
            <NuxtLink
              v-if="part.link"
              :to="part.link"
              :class="part.class || 'text-primary'"
              :style="part.style || 'text-decoration: underline;'"
            >
              {{ part.text }}
            </NuxtLink>
            <span v-else>{{ part.text }}</span>
          </template>
        </div>
        <span v-else v-html="currentTip.body"></span>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" @click="nextMorph" />
      </q-card-actions>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';

type MorphState = 'btn' | 'card1';

interface TipPart {
  text?: string;
  link?: string;
  class?: string;
  style?: string;
  icon?: string;
  color?: string;
  size?: string;
  btn?: boolean;
}
interface Tip {
  title: string;
  body?: string | TipPart[];
  list?: TipPart[];
}

const nextMorphStep: Record<MorphState, MorphState> = {
  btn: 'card1',
  card1: 'btn',
};

const tipsByRoute: Record<string, Tip> = {
  '/': {
    title: 'Welcome!',
    body: [
      { text: 'This is the dashboard home. For more help, visit the ' },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/login': {
    title: 'Login',
    body: [
      {
        text: 'Sign in to access your dashboard. If you need help, visit the ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/activity': {
    title: 'Service Activity',
    body: [
      { text: 'Monitor all service activity here. For more help, visit the ' },
      {
        link: '/help/terms',
        text: 'Terminology Page',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
    list: [
      { btn: true, icon: 'stop', color: 'red', text: '- Stop' },
      {
        btn: true,
        icon: 'refresh',
        color: 'secondary',
        text: '- Generate a contract',
      },
      {
        btn: true,
        icon: 'arrow_outward',
        color: 'orange',
        text: '- Inspect item',
      },
    ],
  },
  '/activity/tasks': {
    title: 'Task Executions',
    body: [
      {
        text: 'View and manage all task executions. For more help, visit the ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
    list: [
      { icon: 'check', color: 'green', text: '- Complete' },
      { icon: 'play_arrow', color: 'blue', text: '- Running' },
      { icon: 'schedule', color: 'warning', text: '- Scheduled' },
      { icon: 'close', color: 'red', text: '- Failed' },
      { btn: true, icon: 'stop', color: 'red', text: '- Stop' },
      {
        btn: true,
        icon: 'refresh',
        color: 'secondary',
        text: '- Generate a contract',
      },
      {
        btn: true,
        icon: 'arrow_outward',
        color: 'orange',
        text: '- Inspect item',
      },
    ],
  },
  '/activity/routines': {
    title: 'Routine Executions',
    body: [
      {
        text: 'View and manage all routine executions. For more help, visit the ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
    list: [
      { icon: 'check', color: 'green', text: '- Complete' },
      { icon: 'play_arrow', color: 'blue', text: '- Running' },
      { icon: 'schedule', color: 'warning', text: '- Scheduled' },
      { icon: 'close', color: 'red', text: '- Failed' },
      { btn: true, icon: 'stop', color: 'red', text: '- Stop' },
      {
        btn: true,
        icon: 'refresh',
        color: 'secondary',
        text: '- Generate a contract',
      },
      {
        btn: true,
        icon: 'arrow_outward',
        color: 'orange',
        text: '- Inspect item',
      },
    ],
  },
  '/activity/signals': {
    title: 'Signal Executions',
    body: [
      {
        text: 'View and manage all signal executions. For more help, visit the ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
    list: [
      { icon: 'check', color: 'green', text: '- Complete' },
      { icon: 'play_arrow', color: 'blue', text: '- Running' },
      { icon: 'schedule', color: 'warning', text: '- Scheduled' },
      { icon: 'close', color: 'red', text: '- Failed' },
      { btn: true, icon: 'stop', color: 'red', text: '- Stop' },
      {
        btn: true,
        icon: 'refresh',
        color: 'secondary',
        text: '- Generate a contract',
      },
      {
        btn: true,
        icon: 'arrow_outward',
        color: 'orange',
        text: '- Inspect item',
      },
    ],
  },
  '/activity/servers': {
    title: 'Servers',
    body: [
      { text: 'Inspect server details and status. For more help, visit the ' },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/services': {
    title: 'Services',
    body: [
      { text: 'Manage your static services here. For more help, visit the ' },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
    list: [
      { icon: 'check', color: 'green', text: '- Complete' },
      { icon: 'play_arrow', color: 'blue', text: '- Running' },
      { icon: 'schedule', color: 'warning', text: '- Scheduled' },
      { icon: 'close', color: 'red', text: '- Failed' },
      { btn: true, icon: 'stop', color: 'red', text: '- Stop' },
      {
        btn: true,
        icon: 'refresh',
        color: 'secondary',
        text: '- Generate a contract',
      },
      {
        btn: true,
        icon: 'arrow_outward',
        color: 'orange',
        text: '- Inspect item',
      },
    ],
  },
  '/services/tasks': {
    title: 'Static Tasks',
    body: [
      { text: 'Browse and manage static tasks. For more help, visit the ' },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
    list: [
      { icon: 'fiber_manual_record', color: 'green', text: '- Unique' },
      {
        btn: true,
        icon: 'refresh',
        color: 'secondary',
        text: '- Generate a contract',
      },
      {
        btn: true,
        icon: 'arrow_outward',
        color: 'primary',
        text: '- Inspect item',
      },
    ],
  },
  '/services/routines': {
    title: 'Static Routines',
    body: [
      { text: 'Browse and manage static routines. For more help, visit the ' },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
    list: [
      {
        btn: true,
        icon: 'refresh',
        color: 'secondary',
        text: '- Generate a contract',
      },
      {
        btn: true,
        icon: 'arrow_outward',
        color: 'primary',
        text: '- Inspect item',
      },
    ],
  },
  '/agents': {
    title: 'Agents',
    body: [
      { text: 'View and manage your agents. For more help, visit the ' },
      {
        text: 'FAQ',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
    list: [
      { icon: 'check', color: 'green', text: '- Complete' },
      { icon: 'play_arrow', color: 'blue', text: '- Running' },
      { icon: 'schedule', color: 'warning', text: '- Scheduled' },
      { icon: 'close', color: 'red', text: '- Failed' },
      { btn: true, icon: 'stop', color: 'red', text: '- Stop' },
      {
        btn: true,
        icon: 'refresh',
        color: 'secondary',
        text: '- Generate a contract',
      },
      {
        btn: true,
        icon: 'arrow_outward',
        color: 'orange',
        text: '- Inspect item',
      },
    ],
  },
  '/agents/contracts': {
    title: 'Agent Contracts',
    body: [
      { text: 'View contracts for your agents. For more help, visit the ' },
      {
        text: 'FAQ',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
    list: [
      { icon: 'check', color: 'green', text: '- Complete' },
      { icon: 'play_arrow', color: 'blue', text: '- Running' },
      { icon: 'schedule', color: 'warning', text: '- Scheduled' },
      { icon: 'close', color: 'red', text: '- Failed' },
      { btn: true, icon: 'stop', color: 'red', text: '- Stop' },
      {
        btn: true,
        icon: 'refresh',
        color: 'secondary',
        text: '- Generate a contract',
      },
      {
        btn: true,
        icon: 'arrow_outward',
        color: 'orange',
        text: '- Inspect item',
      },
    ],
  },
  '/help': {
    title: 'Help',
    body: [
      { text: 'Find documentation, guides, and more. See also ' },
      {
        text: 'FAQ',
        link: '/help/faq',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: ' and ' },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/help/faq': {
    title: 'FAQ',
    body: [
      {
        text: 'Frequently asked questions about the dashboard. For more help, visit ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/help/terms': {
    title: 'Terminology Page',
    body: [
      {
        text: 'Learn about the terms used in this dashboard. For more help, visit the ',
      },
      {
        text: 'FAQ',
        link: '/help/faq',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/help/tutorials': {
    title: 'Tutorials',
    body: [
      {
        text: 'Step-by-step guides to help you get started. For more help, visit ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/help/examples': {
    title: 'Examples',
    body: [
      {
        text: 'See practical examples of how to use the dashboard. For more help, visit ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/help/processingGraph': {
    title: 'Processing Graph Guide',
    body: [
      {
        text: 'Learn about processing graphs and their chapters. For more help, visit ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/help/processingGraph/chapter1': {
    title: 'Processing Graph - Chapter 1',
    body: [
      { text: 'Introduction to processing graphs. For more help, visit ' },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/help/processingGraph/chapter2': {
    title: 'Processing Graph - Chapter 2',
    body: [
      { text: 'Advanced processing graph concepts. For more help, visit ' },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/help/processingGraph/chapter3': {
    title: 'Processing Graph - Chapter 3',
    body: [
      { text: 'Agent integration in processing graphs. For more help, visit ' },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/help/processingGraph/chapter4': {
    title: 'Processing Graph - Chapter 4',
    body: [
      {
        text: 'More advanced topics in processing graphs. For more help, visit ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/help/processingGraph/chapter5': {
    title: 'Processing Graph - Chapter 5',
    body: [
      { text: 'Final chapter on processing graphs. For more help, visit ' },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/activity/tasks/[id]': {
    title: 'Task Execution Details',
    body: [
      {
        text: 'Detailed information about a specific task execution. For more help, visit the ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/activity/routines/[id]': {
    title: 'Routine Execution Details',
    body: [
      {
        text: 'Detailed information about a specific routine execution. For more help, visit the ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/activity/servers/[id]': {
    title: 'Server Details',
    body: [
      {
        text: 'Detailed information about a specific server. For more help, visit the ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/services/[id]': {
    title: 'Service Details',
    body: [
      {
        text: 'Detailed information about a specific service. For more help, visit the ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/services/tasks/[id]': {
    title: 'Static Task Details',
    body: [
      {
        text: 'Detailed information about a static task. For more help, visit the ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/services/routines/[id]': {
    title: 'Static Routine Details',
    body: [
      {
        text: 'Detailed information about a static routine. For more help, visit the ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/agents/[id]': {
    title: 'Agent Details',
    body: [
      {
        text: 'Detailed information about a specific agent. For more help, visit the ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
  '/agents/contracts/[id]': {
    title: 'Agent Contract Details',
    body: [
      {
        text: 'Detailed information about a specific agent contract. For more help, visit the ',
      },
      {
        text: 'Terminology Page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  },
};

const morphGroupModel = ref<MorphState>('btn');
const route = useRoute();

const currentTip = computed<Tip>(() => {
  if (tipsByRoute[route.path]) return tipsByRoute[route.path];
  for (const key in tipsByRoute) {
    if (key.includes('[id]')) {
      const pattern = new RegExp('^' + key.replace('[id]', '[^/]+') + '$');
      if (pattern.test(route.path)) return tipsByRoute[key];
    }
  }
  const base = '/' + route.path.split('/')[1];
  if (tipsByRoute[base]) return tipsByRoute[base];
  return {
    title: 'No tips for this page',
    body: [
      { text: 'For more help, visit the ' },
      {
        text: 'Help UI page',
        link: '/help/terms',
        class: 'text-primary',
        style: 'text-decoration: underline;',
      },
      { text: '.' },
    ],
  };
});

function nextMorph() {
  morphGroupModel.value = nextMorphStep[morphGroupModel.value];
}
</script>
