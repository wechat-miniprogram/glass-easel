export default Page({
  data: {
    showAgain: false,
  },
  helloTap() {
    this.setData({
      showAgain: true,
    })
  },
})
