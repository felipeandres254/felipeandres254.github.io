//
export default {
  props: {
    path: { type: String, default: '/' },
    params: { type: Object, default: () => ({}) }
  },
  data() {
    return {
      loading: true,
      error: null,
      data: null,
    }
  },
  watch: {
    path() {
      this.request()
    },
    params: {
      handler() {
        this.request()
      },
      deep: true,
    },
  },
  methods: {
    async request() {
      this.loading = true
      try {
        const { data } = await window.$axios.request({
          data: {
            devMode: true,
            function: '$view',
            parameters: [{ path, params }], } })
        this.error = null
        this.data = data
      } catch (error) {
        this.error = error
        this.data = null
      }
      this.loading = false
    }
  },
  render() {
    console.log(this.$slots)
    return ''
    /**
    this.$slots.default({
      loading: this.loading,
      error: this.error,
      data: this.data,
    })
    /**/
  },
}
