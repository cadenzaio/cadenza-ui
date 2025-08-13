<template>
  <NuxtLayout name="dashboard-layout">
    <NuxtLayout name="dashboard-main-layout">
      <div>
        <h1>Meta Routines</h1>
        <p>
          Manage your routines
          <NuxtLink :to="'/meta/routines/1'">here</NuxtLink>.
        </p>
      </div>
    </NuxtLayout>
  </NuxtLayout>
</template>
