# class测试要点
根据不同的测试对象，列举一些通用的测试要点。具体还需要根据测试功能来决定。

## 1 class测试要点
（1）数据类型校验: 需要测试所有支持的数据类型，对于不支持的数据类型，比如dict， set， array vector是否能正常报错

（2）类名/函数名/变量名需要设置与ddb内置函数一直的情况

（3）需要测试类的继承，父类，超类，子类和父类中有同名函数，子类继承父类的属性

（4）测试class与reactiveStateEngine一起使用

（5）在类的方法中，包含if-else 语句，do-while语句，for 语句，break和continue语句

（6）序列化和反序列化

需要注意function view和scheduleJob后重启是否正常，以及是否能正常执行

（7）在module中定义class





