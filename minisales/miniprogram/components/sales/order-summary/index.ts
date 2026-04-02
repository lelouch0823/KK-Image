Component({
  properties: {
    summary: {
      type: Object,
      value: null,
    },
  },
  methods: {
    onPreview() {
      const summary = this.properties.summary as { mainImage?: string } | null;
      if (!summary?.mainImage) {
        return;
      }

      this.triggerEvent('preview', {
        url: summary.mainImage,
      });
    },
  },
});
