# PU6组工作集

一个基于 Flask 的一站式工作文件内容处理平台项目骨架。

## 本地启动

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
flask --app run run --debug --port 5002
```

启动后访问：

```text
http://127.0.0.1:5002
```

## 账号管理

平台不开放注册，账号由组长统一分配。

创建成员账号：

```bash
flask --app run create-user zhangsan --name 张三 --role member
```

创建可维护话术库的管理账号：

```bash
flask --app run create-user lisi --name 李四 --role manager
```

角色说明：

- `leader` / `admin` / `manager`：可新增、导入、删除和清空话术。
- `member`：只能进入专题、匹配话术和复制推荐结果。

重置成员密码：

```bash
flask --app run reset-password zhangsan
```

生产部署前请设置独立的 `SECRET_KEY` 环境变量。
