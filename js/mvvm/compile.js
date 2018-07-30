function Compile(el, vm) {
  // 保存vm
  this.$vm = vm;
  // 保存el元素
  this.$el = this.isElementNode(el) ? el : document.querySelector(el);

  // el元素必须存在
  if (this.$el) {
    // 1. 将el所有的子节点封装到一个fragment对象中, 并保存
    this.$fragment = this.node2Fragment(this.$el);
    // 2. 初始化: 解析fragment所有层次的子节点
    this.init();
    // 3. 将解析好的fragment添加到el中(初始化显示完成)
    this.$el.appendChild(this.$fragment);
  }
}

Compile.prototype = {
  node2Fragment: function (el) {
    // 创建容器对象
    var fragment = document.createDocumentFragment(),
      child;

    // 将el中所有子节点添加到fragment
    while (child = el.firstChild) {
      fragment.appendChild(child);
    }

    return fragment;
  },

  init: function () {
    this.compileElement(this.$fragment);
  },

  /*
  编译指定元素的所有子节点
   */
  compileElement: function (el) {
    // 得到所有子节点
    var childNodes = el.childNodes,
      // 保存编译对象
      me = this;
    // 遍历所有子节点
    [].slice.call(childNodes).forEach(function (node) {
      // 得到节点的文本内容
      var text = node.textContent;
      // 匹配大括号表达式的正则对象
      var reg = /\{\{(.*)\}\}/;  // {{name}}

      //当前子节点是一个元素
      if (me.isElementNode(node)) {
        // 编译元素中的指令属性
        me.compile(node);
      // 当前子节点是大括号表达式格式的文本节点
      } else if (me.isTextNode(node) && reg.test(text)) {
        // 编译大括号表达式文本节点
        me.compileText(node, RegExp.$1);// RegExp.$1: 表达式  name
      }

      // 如果子节点还有子节点
      if (node.childNodes && node.childNodes.length) {
        // 递归调用编译--->实现所有层次 子节点的编译
        me.compileElement(node);
      }
    });
  },

  compile: function (node) {
    // 得到所有属性
    var nodeAttrs = node.attributes,
      me = this;

    // 遍历所有属性
    [].slice.call(nodeAttrs).forEach(function (attr) {
      // 得到属性名: v-on:click
      var attrName = attr.name;
      // 如果是指令属性
      if (me.isDirective(attrName)) {
        // 得到表达式/属性值: show
        var exp = attr.value;
        // 得到指令名: on:click
        var dir = attrName.substring(2);
        // 如果是事件指令
        if (me.isEventDirective(dir)) {
          // 解析事件指令
          compileUtil.eventHandler(node, me.$vm, exp, dir);
          // 普通指令
        } else {
          // 解析一般指令
          compileUtil[dir] && compileUtil[dir](node, me.$vm, exp);
        }

        node.removeAttribute(attrName);
      }
    });
  },

  // 编译文本: 大括号表达式
  compileText: function (node, exp) {
    compileUtil.text(node, this.$vm, exp);
  },

  isDirective: function (attr) {
    return attr.indexOf('v-') == 0;
  },

  isEventDirective: function (dir) {
    return dir.indexOf('on') === 0;
  },

  isElementNode: function (node) {
    return node.nodeType == 1;
  },

  isTextNode: function (node) {
    return node.nodeType == 3;
  }
};

/*
编译指令/大括号表达式的工具对象
 */
var compileUtil = {
  // 对应v-text/{{}}
  text: function (node, vm, exp) {
    this.bind(node, vm, exp, 'text');
  },

  // 对应v-html
  html: function (node, vm, exp) {
    this.bind(node, vm, exp, 'html');
  },

  // 对应v-model
  model: function (node, vm, exp) {
    this.bind(node, vm, exp, 'model');

    var me = this,
      val = this._getVMVal(vm, exp);
    node.addEventListener('input', function (e) {
      var newValue = e.target.value;
      if (val === newValue) {
        return;
      }

      me._setVMVal(vm, exp, newValue);
      val = newValue;
    });
  },

  // 对应v-class
  class: function (node, vm, exp) {
    this.bind(node, vm, exp, 'class');
  },

  /*
  真正做数据绑定处理的方法
  node: 节点
  vm
  exp: 表达式  name
  dir: 指令名  text/html/model/class
   */
  bind: function (node, vm, exp, dir) {

    // 根据指令名确定更新节点的函数
    var updaterFn = updater[dir + 'Updater'];

    // 调用更新函数更新节点(初始化)
    updaterFn && updaterFn(node, this._getVMVal(vm, exp));

    new Watcher(vm, exp, function (value, oldValue) {
      updaterFn && updaterFn(node, value, oldValue);
    });
  },

  /*
  解析事件指令
  exp: 表达式   show
  dir: 指令名   on:click
   */
  eventHandler: function (node, vm, exp, dir) {
    // 从指令名中取出事件类型/名: click
    var eventType = dir.split(':')[1],
      // 根据表达式从methods配置对象取出对应的函数
      fn = vm.$options.methods && vm.$options.methods[exp];
    // 如果都存在
    if (eventType && fn) {
      // 给节点添加指定事件名和回调函数的dom事件监听(回调函数的this强制绑定为vm)
      node.addEventListener(eventType, fn.bind(vm), false);
    }
  },

  // 得到表达式对应的属性值
  _getVMVal: function (vm, exp) {
    var val = vm._data;
    exp = exp.split('.');
    exp.forEach(function (k) {
      val = val[k];
    });
    return val;
  },

  _setVMVal: function (vm, exp, value) {
    var val = vm._data;
    exp = exp.split('.');
    exp.forEach(function (k, i) {
      // 非最后一个key，更新val的值
      if (i < exp.length - 1) {
        val = val[k];
      } else {
        val[k] = value;
      }
    });
  }
};

/*
包含n个更新节点方法的对象
 */
var updater = {
  // 更新节点的textContent属性
  textUpdater: function (node, value) {
    node.textContent = typeof value == 'undefined' ? '' : value;
  },

  // 更新节点的innerHTML属性
  htmlUpdater: function (node, value) {
    node.innerHTML = typeof value == 'undefined' ? '' : value;
  },

  // 更新节点的className属性
  classUpdater: function (node, value, oldValue) {
    // 得到静态类名
    var className = node.className;
    // 合并两种类名, 赋值给className属性
    node.className = (className ? className+' ' : '') + value;
  },

  // 更新节点的value属性
  modelUpdater: function (node, value, oldValue) {
    node.value = typeof value == 'undefined' ? '' : value;
  }
};