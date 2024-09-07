//
const CLIENT_ID = '169826553548-c1o8b8sh7f25qlv1qt026kieucus8r72.apps.googleusercontent.com'
const SCRIPT_ID = 'AKfycbxZRwM-SIMNN_vA_P2k1UxRV4iIWNum9CCigujzaZPg'

export default {
  props: {
    path: { type: String, default: '/', required: true },
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
    return this.$scopedSlots.default({
      loading: this.loading,
      error: this.error,
      data: this.data,
    })
  }
}
