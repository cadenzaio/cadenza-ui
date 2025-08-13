<template>
  <q-card class="custom-card q-mb-md overflow-auto q-ma-sm">
    <div class="col flex-grow q-pa-md">
      <div class="row text-h5">
        <slot name="title" />
      </div>
      <div class="row">
        <slot name="info" />
      </div>
    </div>
  </q-card>
</template>

<script setup lang="ts">

</script>

<style>
.custom-card {
  border-radius: 20px !important;
  min-width: 25dvw;
  max-width: 45dvw;
  max-height: 60dvh;
}
</style>
