<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <div class="chapter-content">
        <h1>Processing Graph Tutorial</h1>
        <p>Welcome! Select a chapter to get started:</p>
        <ul>
          <li><NuxtLink to="/help/processingGraph/chapter1">Chapter 1 – Hello Graph!</NuxtLink></li>
          <li><NuxtLink to="/help/processingGraph/chapter2">Chapter 2 – Branch Out</NuxtLink></li>
          <li><NuxtLink to="/help/processingGraph/chapter3">Chapter 3 – Distributed Without Tears</NuxtLink></li>
          <li><NuxtLink to="/help/processingGraph/chapter4">Chapter 4 – Break Stuff Gracefully</NuxtLink></li>
          <li><NuxtLink to="/help/processingGraph/chapter5">Chapter 5 – Real-World Flow</NuxtLink></li>
        </ul>
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>

<script setup lang="ts">
</script>

<style>
.chapter-content {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1rem;
}
.chapter-content ul {
  list-style: none;
  padding: 0;
}
.chapter-content li {
  margin: 1rem 0;
  font-size: 1.2em;
}
.chapter-content a {
  color: #42b983;
  text-decoration: none;
  transition: color 0.2s;
}
.chapter-content a:hover {
  color: #2c3e50;
}
</style>
