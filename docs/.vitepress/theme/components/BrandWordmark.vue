<script setup lang="ts">
import { withBase } from 'vitepress'
</script>

<template>
  <span class="brand-lockup">
    <img class="brand-symbol" :src="withBase('/favicon.svg')" width="36" height="36" alt="" aria-hidden="true">
    <span class="brand-name"><span>DataTalks</span> <span class="brand-learning">Learning</span></span>
  </span>
</template>
