# 黄氏家族谱网站

一个静态网页，点击姓名可以展开下一代。电脑和手机都可以看。

## 文件
| 文件 | 用途 | 需要改吗 |
|---|---|---|
| `index.html` | 网页结构、标题 | 改标题时才需要 |
| `style.css` | 外观（颜色、字体、大小） | 一般不用 |
| `app.js` | 展开/收起的功能 | 一般不用 |
| `data.js` | **族谱名单** | 更新族谱时改这个 |

## 本地预览
双击 `index.html`，用浏览器打开即可。

## 上传到 GitHub Pages
1. 在 GitHub 新建一个仓库（Repository），例如 `huang-zupu`。
2. 点 **Add file → Upload files**，把这 5 个文件拖进去，按 **Commit changes**。
3. 进入 **Settings → Pages**，Source 选 **Deploy from a branch**，Branch 选 `main`、文件夹 `/ (root)`，按 **Save**。
4. 等一两分钟，网址会是：`https://你的用户名.github.io/huang-zupu/`

注意：GitHub Pages 的网页是公开的，有网址的人都能看到。网页已设置不让搜索引擎收录，但这不等于私密。

## 更新族谱
1. 在 Excel《黄氏族谱》的「族谱」表里新增或修改人员。
2. 选中 A 到 C 列（编号、姓名、父亲编号）所有有资料的行，复制。
3. 打开 `data.js`，把内容粘贴到两个 ` 符号之间，取代旧名单。
4. 在 GitHub 上传新的 `data.js`（覆盖旧的），网站一两分钟后自动更新。

## 小设置
在 `app.js` 最上面：
`ONE_BRANCH_AT_A_TIME = true` 表示打开一个人的分支时，会自动收起他兄弟的分支。改成 `false` 就可以同时展开多个。
