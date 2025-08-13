<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <template #title>
        FAQ
      </template>
      <div class="faq-container">
        <div v-for="(faq, idx) in faqs" :key="idx" class="faq-item">
          <div class="faq-question" @click="toggle(idx)">
            {{ faq.question }}
          </div>
          <div v-if="openIndex === idx" class="faq-answer-card">
            <div class="faq-answer">
              {{ faq.answer }}
            </div>
          </div>
        </div>
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useAppStore } from '~/stores/app'
import { useRoute } from '#app'

const route = useRoute()

const faqs = [
  {
    question: 'How do I reset my password?',
    answer: 'Go to your account settings and click on "Reset Password". Follow the instructions sent to your email.'
  },
  {
    question: 'Where can I find the user manual?',
    answer: 'The user manual is available under the Help section in the main menu.'
  },
  {
    question: 'How do I contact support?',
    answer: 'You can contact support by clicking the "Contact Us" link at the bottom of the page.'
  },
  {
    question: 'Can I export my data?',
    answer: 'Yes, you can export your data from the settings page under the "Export Data" option.'
  },
  {
    question: 'How do I update my profile information?',
    answer: 'Navigate to your profile page and click on "Edit Profile" to update your information.'
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes, we use industry-standard encryption and security practices to protect your data.'
  },
  {
    question: 'Can I use the dashboard on mobile devices?',
    answer: 'Yes, the dashboard is fully responsive and works on all modern mobile devices.'
  },
  {
    question: 'How do I add a new user?',
    answer: 'Go to the Users section and click on "Add User". Fill in the required details and submit.'
  },
  {
    question: 'What browsers are supported?',
    answer: 'We support the latest versions of Chrome, Firefox, Edge, and Safari.'
  },
  {
    question: 'How do I report a bug?',
    answer: 'Please use the "Report a Bug" form in the Help section to submit details about the issue.'
  }
]

const openIndex = ref(null)

function toggle(idx) {
  openIndex.value = openIndex.value === idx ? null : idx
}

onMounted(() => {
  const appStore = useAppStore()
  appStore.setCurrentSection('help')
})

watch(
  () => route.fullPath,
  (newPath) => {
    if (newPath === '/help/faq') {
      const appStore = useAppStore()
      appStore.setCurrentSection('help')
    }
  }
)
</script>

<style scoped>
.faq-container {
  max-width: 700px;
  margin: 2rem auto;
  padding: 1rem;
}
.faq-item {
  margin-bottom: 1.5rem;
}
.faq-question {
  font-weight: bold;
  cursor: pointer;
  padding: 1rem;
  background: #b1b0b07e;
  border-radius: 6px;
  transition: background 0.2s;
}
.faq-question:hover {
  background: #b4bac2;
}
.faq-answer-card {
  margin-top: 0.5rem;
  background: #aaaaaaa4;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.07);
  padding: 1rem;
}
.faq-answer {
  color: #333;
}
</style>
