# 黄氏家族谱网站

一个静态网页，点击姓名可以展开下一代。电脑和手机都可以看。

**网站地址：<https://yisiangeng.github.io/huang_family_zupu/>**

## 文件
| 文件 | 用途 | 需要改吗 |
|---|---|---|
| `index.html` | 网页结构、标题 | 改标题时才需要 |
| `style.css` | 外观（颜色、字体、大小） | 一般不用 |
| `app.js` | 展开/收起的功能 | 一般不用 |
| `data.xlsx` | **族谱名单（Excel）** | 更新族谱时只改这个 |
| `data.js` | 网站读取的名单，由 Excel 自动生成 | 不要手动改 |
| `build_data.py`、`.github/workflows/` | 把 Excel 转成 `data.js` 的程序 | 不用改 |

## 本地预览
双击 `index.html`，用浏览器打开即可。

## 上传到 GitHub Pages
1. 在 GitHub 新建一个仓库（Repository），例如 `huang-zupu`。
2. 点 **Add file → Upload files**，把所有文件（含 `.github` 文件夹和 `data.xlsx`）拖进去，按 **Commit changes**。
3. 进入 **Settings → Pages**，Source 选 **Deploy from a branch**，Branch 选 `main`、文件夹 `/ (root)`，按 **Save**。
4. 等一两分钟，网址会是：`https://你的用户名.github.io/仓库名/`（本站：<https://yisiangeng.github.io/huang_family_zupu/>）

注意：GitHub Pages 的网页是公开的，有网址的人都能看到。网页已设置不让搜索引擎收录，但这不等于私密。

## 更新族谱
只需要改 Excel：
1. 在 `data.xlsx` 的「族谱」表里新增或修改人员（只填 A 到 C 列：编号、姓名、父亲编号）。
2. 在 GitHub 仓库页面点 **Add file → Upload files**，上传新的 `data.xlsx`（覆盖旧的），按 **Commit changes**。
3. GitHub 会自动运行「从 Excel 更新族谱」，重新生成 `data.js`，一两分钟后网站更新。
4. 如果 Excel 有错误（编号重复、父亲编号不存在、有两位始祖等），仓库的 **Actions** 页面会显示红色 ✗ 并列出问题，网站保持旧内容；修正 Excel 再上传即可。

也可以在电脑上直接生成：`pip install openpyxl`，然后运行 `python build_data.py`，再预览或上传。

注意：`data.xlsx` 会和网站一起公开。只有 A 到 C 列会进入网站，但「备注」等其他列在 GitHub 上也是看得到的，不想公开的资料不要写在里面。

## 小设置
在 `app.js` 最上面：
`ONE_BRANCH_AT_A_TIME = true` 表示打开一个人的分支时，会自动收起他兄弟的分支。改成 `false` 就可以同时展开多个。
