<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <div>
        <h1>Meta Tasks</h1>
        <p>
          Manage your tasks
          <NuxtLink :to="'/meta/tasks/1'">here</NuxtLink>.
        </p>
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>
