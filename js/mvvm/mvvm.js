/*
相当于Vue的构造函数
 */
function MVVM(options) {
  // 保存配置对象到vm上
  this.$options = options;
  // 保存data数据对象到vm上和data变量上
  var data = this._data = this.$options.data;
  // 保存vm解决this的问题
  var me = this;

  // 遍历data中所有属性
  Object.keys(data).forEach(function (key) {
    // 对指定属性实现代理
    me._proxy(key);
  });

  observe(data, this);

  // 创建一个编译对象(对模板进行解析)
  this.$compile = new Compile(options.el || document.body, this)
}

MVVM.prototype = {
  $watch: function (key, cb, options) {
    new Watcher(this, key, cb);
  },

  _proxy: function (key) {
    // 保存vm
    var me = this;
    // 给vm添加指定属性名的属性(属性描述符)
    Object.defineProperty(me, key, {
      // 不可重新定义
      configurable: false,
      // 可以枚举
      enumerable: true,
      // 当执行vm.xxx读取属性值时, 自动调用, 读取data中对应属性值返回  -->代理读
      get: function proxyGetter() {
        return me._data[key];
      },
      // 当执行vm.xxx = value时, 自动调用, 将最新的值保存到data对应的属性上 -->代理写
      set: function proxySetter(newVal) {
        me._data[key] = newVal;
      }
    });
  }
};