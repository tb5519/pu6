# 运行数据目录部署说明

`PU6组/instance/` 是线上运行数据目录，里面的 json、bak、上传素材和备份文件都不再交给 Git 管理。

## 本次代码提交内容

- `PU6组/instance/.gitkeep`：只保留空目录占位。
- `PU6组/instance_examples/`：只放空结构模板，不放真实数据。
- `.gitignore`：忽略 `instance` 下的运行数据、备份文件、嵌套 `instance/instance` 和 `instance_bak*`。
- 应用启动时会自动创建缺失的 json 空结构；已有文件不会被覆盖。

## 开发侧一次性提交命令

```bash
git rm --cached -r -- "PU6组/instance"
git add "PU6组/.gitignore" "PU6组/app/__init__.py" "PU6组/instance/.gitkeep" "PU6组/instance_examples" "PU6组/docs/instance-data-deployment.md"
git commit -m "Stop tracking runtime instance data"
git push
```

这些命令只移除 Git 索引里的跟踪关系，不删除本地 `PU6组/instance/` 里的真实数据文件。

## 服务器首次迁移

如果服务器当前还在跟踪 `PU6组/instance/*.json`，第一次不要直接 `git pull`。请在项目 Git 根目录执行：

```bash
git fetch origin
git reset --mixed origin/main
git restore --worktree -- .
git ls-files -- "PU6组/instance"
```

最后一条命令应该只看到：

```text
PU6组/instance/.gitkeep
```

同时服务器磁盘上的 `PU6组/instance/classes.json`、`users.json`、`database_settings.json` 等真实数据文件会保留为未跟踪/已忽略文件。

## 以后更新代码

完成首次迁移后，服务器以后更新代码只需要：

```bash
git pull
```

`PU6组/instance/` 里的真实运行数据不会再被 Git 覆盖，也不会因为这些 json 文件产生 pull 冲突。
