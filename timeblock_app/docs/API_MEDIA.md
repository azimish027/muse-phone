---
skill_name: MEDIA
display_name: 媒体能力
description: |
  用于访问客户端媒体能力，包含调用相机、读写相册、图片上传和视频选择等。
  【场景规则（必须遵循）】
      - 图片相关选择、拍照、上传、保存到相册必须选择 MEDIA（不要误选 FS）。
      - 普通预览、远端处理或业务提交使用 `chooseImage/takePhoto -> uploadImage`，仅使用返回 URL。
      - 明确使用已具备的端上模型且其 SDK 接受 Blob 时，使用 `chooseImage/takePhoto -> readFile(base64)`，不为本地处理上传原图；同时参见 API_FS.md。
      - 禁止 `<input type="file">`、`URL.createObjectURL()`、`FileReader`、`canvas.toBlob()` 等浏览器回退方案；推荐 `chooseImage({ count: 1, sourceType: ['album','camera'], sizeType: ['original'] })`。
      - `saveImageToPhotosAlbum({ filePath })` 的 `filePath` 必须为可访问 URL 或 Data URL，禁止 `blob:` 与未上传本地路径。
      - 图片输入统一使用 `window.lingguang.chooseImage/takePhoto`；普通业务上传换取 URL，明确端上处理时在本地读取。
      - 选择视频必须使用 `window.lingguang.chooseVideo({ sourceType: ['album'] })`；禁止 `<input type="file">` 等浏览器回退。必须捕获失败并在界面展示可重试状态。
api_file: API_MEDIA.md
enable: true
min_client_version: "1.0.32"
---

# 强制规范（容器/嵌入式 H5 环境）

- 选择/拍照后返回的是本地/容器路径，不能直接用于 `<img src>`。
- 普通预览、远端处理或业务提交调用 `window.lingguang.uploadImage({ filePath })` 换取可访问的 URL，再用于后续处理，不按路径前缀分流。
- 明确端上 WASM/本地模型处理且现有 SDK 接受 Blob 时，使用 `readFile({ filePath, encoding: 'base64' })`，在本地解码为 Blob 并交给该 SDK；不得先上传原图。
- 本地处理推荐 `sizeType: ['compressed']`，在读取前按所用能力的合同检查 `tempFiles[0].size`；这条路径不表示工作区已安装某个模型或依赖。
- 推荐选择参数：`chooseImage({ count: 1, sourceType: ['album','camera'], sizeType: ['original'] })`。
- 禁止保留 `<input type="file">` 回退，禁止使用 `URL.createObjectURL()`、`blob:` URL、`FileReader` 等浏览器原生路径/URL 直接渲染。
- 禁止通用浏览器上传链路；按上述业务边界使用上传 URL 或本地读取路径。
- 保存到相册时，`saveImageToPhotosAlbum({ filePath })` 的 `filePath` 应为可访问 URL 或 Data URL（如 `canvas.toDataURL()`），不要传 `blob:` 或未上传的本地路径。
- 视频选择必须走 `chooseVideo`。当前只支持相册来源；运行时会拒绝超过 60 秒或超过 20 MiB 的视频，也会在低版本客户端缺少底层能力时拒绝。
- 视频选择失败必须进入用户可见的失败状态并保留重试入口，不允许吞掉异常、伪造成功结果或回退到浏览器文件选择器。

# 普通图片业务的“上传换URL”示例

```ts
const handleImageSelected = useCallback(async (filePath: string) => {
  try {
    const { url } = await window.lingguang.uploadImage({
      filePath,
      compress: 'none', // 或按需：'medium'
    });
    setImageUrl(url);
    setStep('select');
  } catch (e) {
    console.error('上传失败:', e);
  }
}, []);
```

# window.lingguang.chooseVideo

从系统相册选择一个视频。公开接口保留 `sourceType`，当前仅支持 `album`，以后客户端支持相机时可在不改变 options 结构的前提下扩展取值。

运行时会先检查客户端是否同时支持 `Multimedia.chooseVideo` 和 `FSManager.getFileInfo`，随后校验视频时长与精确文件大小。应用不需要、也不应直接调用 `FSManager.getFileInfo`。

## 函数签名

```typescript
window.lingguang.chooseVideo(options?: {
  sourceType?: Array<'album'>;
  compressed?: boolean;
}): Promise<{
  filePath: string;
  duration: number;
  size: number;
  width: number;
  height: number;
  thumbnailPath: string | null;
}>
```

## 参数

- **sourceType**（可选）：视频来源，当前只能传 `['album']`，默认值也是 `['album']`。空数组、`camera` 或其他值会失败。
- **compressed**（可选）：是否压缩相册视频，默认 `false`。

`maxDuration` 不对应用开放，运行时固定使用 60 秒并在选择完成后再次校验，应用无法放宽限制。

## 成功结果

- **filePath**：由客户端 `apFilePath` 标准化得到的虚拟资源路径，可继续传给 `window.lingguang.uploadFile({ filePath })`，不能作为普通网络 URL 使用。
- **duration**：视频时长，单位秒，成功时保证不超过 60。
- **size**：通过 `FSManager.getFileInfo` 获取的精确字节数，成功时保证不超过 `20 * 1024 * 1024`。
- **width / height**：视频宽高，单位像素。
- **thumbnailPath**：客户端返回的视频缩略图资源路径，可能为 `null`。

不要使用 CandyJar `chooseVideo.size` 自行判断大小；相册场景中该字段可能不准确，公开结果的 `size` 已被运行时替换为精确值。

## 失败处理

Promise reject 的 `Error.code` 可能包括：

- `CHOOSE_VIDEO_UNSUPPORTED`：当前客户端不支持选择视频。
- `GET_FILE_INFO_UNSUPPORTED`：当前客户端无法精确读取文件大小。
- `VIDEO_DURATION_EXCEEDED`：视频超过 60 秒。
- `VIDEO_SIZE_EXCEEDED`：视频超过 20 MiB。
- `INVALID_VIDEO_RESULT`：客户端返回的视频信息不完整。

客户端取消及其他原生错误会保留其原始错误码。所有失败都必须展示用户可理解的提示并允许重新选择。

```tsx
type VideoStatus = 'idle' | 'choosing' | 'ready' | 'error';

const [videoStatus, setVideoStatus] = useState<VideoStatus>('idle');
const [videoError, setVideoError] = useState('');

async function handleChooseVideo() {
  setVideoStatus('choosing');
  setVideoError('');

  try {
    const video = await window.lingguang.chooseVideo({
      sourceType: ['album'],
      compressed: false,
    });
    setSelectedVideo(video);
    setVideoStatus('ready');
  } catch (error) {
    const message = error instanceof Error ? error.message : '视频选择失败，请重试';
    setVideoError(message);
    setVideoStatus('error');
  }
}
```

# window.lingguang.chooseImage

打开手机相册，允许用户选择一张或多张图片。

## 函数签名

```typescript
window.lingguang.chooseImage(options?: {
  count?: number;
  sourceType?: ('album' | 'camera')[];
  sizeType?: ('original' | 'compressed')[];
}): Promise<{
  tempFiles: Array<{
    path: string;
    size: number;
  }>;
}>
```

## 参数

**options** (Object): 配置对象

- **count** (number, 可选): 最多选择的图片数量，范围 1-9，默认值为 1
- **sourceType** (Array.<string>, 可选): 图片来源，默认值为 `['album', 'camera']`
  - `'album'`: 相册
  - `'camera'`: 相机
  - 可单独指定一个或两个都传。两个都传时让用户自行选择图片是拍摄的还是相册选择的
- **sizeType** (Array.<string>, 可选): 所选的图片的尺寸，默认值为 `['original', 'compressed']`
  - `'original'`: 原图
  - `'compressed'`: 压缩图

## 返回值

返回 Promise，成功时 resolve，失败时 reject。

**成功时（resolve）返回：**

```javascript
{
  tempFiles: [
    {
      path: 'file:///path/to/image1.jpg',  // 本地文件路径（仅用于原生端，不能直接用于 Web）
      size: 1024000  // 文件大小（字节）
    },
    // ... 更多图片
  ]
}
```

**失败时（reject）返回：**

```javascript
{
  name: 'USER_CANCEL',  // 错误类型枚举（string）
  message: '用户取消了选择'  // 错误信息（string）
}
```

## 示例

```javascript
try {
  const result = await window.lingguang.chooseImage(options);
  console.log('选择的图片:', result);
} catch (error) {
  console.log('选择失败:', error.message);
}
```

## 示例 从相册选择图片显示到页面（统一上传换URL）
```javascript
try {
  // 先选择图片
  const chooseResult = await window.lingguang.chooseImage({
    count: 1,
    sourceType: ['album', 'camera'],
    sizeType: ['original']
  });

  const imagePath = chooseResult.tempFiles[0].path;

  // 上传图片
  const uploadResult = await window.lingguang.uploadImage({
    filePath: imagePath  // 使用本地路径
  });

  console.log('上传成功，图片 URL可用于<img src>:', uploadResult.url);
} catch (error) {
  console.log('上传失败:', error.message);
}
```

## 注意事项

1. **图片路径的使用**：
   - `path` 字段返回的是原生文件系统路径，不能直接用于 `<img src>` 中；必须先 `uploadImage` 换 URL 后再回显
   - `path` 主要用于原生端文件操作（上传）、传递给其他原生 API、调试和日志记录

2. 选择图片数量限制为 1-9 张

3. 避免图片通过canvas加工后出现 `Canvas 污染（Tainted Canvas）错误`
  - 当你从相册选择图片并上传图片(uploadImage)获取到URL，并准备通过canvas处理图片时
  - 使用 new Image() 创建图片对象
  - 设置 crossOrigin = 'anonymous'
  - 在 onload 回调中绘制到 canvas
  - 然后调用 toDataURL()
  - 这种方式可避免Canvas 污染（Tainted Canvas）错误

# window.lingguang.takePhoto

打开手机相机，允许用户拍摄照片。

## 函数签名

```typescript
window.lingguang.takePhoto(options?: {
  sizeType?: ('original' | 'compressed')[];
}): Promise<{
  tempFiles: Array<{
    path: string;
    size: number;
  }>;
}>
```

## 参数

**options** (Object): 配置对象

- **sizeType** (Array.<string>, 可选): 所选的图片的尺寸，默认值为 `['original', 'compressed']`
  - `'original'`: 原图
  - `'compressed'`: 压缩图

## 返回值

返回 Promise，成功时 resolve，失败时 reject。

**成功时（resolve）返回：**

```javascript
{
  tempFiles: [
    {
      path: 'file:///path/to/photo.jpg',  // 本地文件路径（仅用于原生端，不能直接用于 Web）
      size: 1024000  // 文件大小（字节）
    }
  ]
}
```

**失败时（reject）返回：**

```javascript
{
  name: 'USER_CANCEL',  // 错误类型枚举（string）
  message: '用户取消了拍摄'  // 错误信息（string）
}
```

## 示例

```javascript
try {
  const result = await window.lingguang.takePhoto(options);
  console.log('拍摄的照片:', result);
} catch (error) {
  console.log('拍摄失败:', error.message);
}
```

## 注意事项

1. **图片路径的使用**：
   - `path` 字段返回的是原生文件系统路径，不能直接用于 `<img src>` 中
      - 如需回显选择的图片到页面，请使用`window.lingguang.uploadImage` 上传获取URL之后回显
   - `path` 主要用于原生端文件操作（上传）、传递给其他原生 API、调试和日志记录

2. 需要相机权限，用户可能会拒绝权限请求

# window.lingguang.saveImageToPhotosAlbum

将 H5 应用中的图片保存到手机系统相册。
使用完整 Data URL 或可访问的网络 URL，不传未上传的本地路径或 blob URL。

## 函数签名

```typescript
window.lingguang.saveImageToPhotosAlbum(options: {
  filePath: string;
}): Promise<void>
```

## 参数

**options** (Object): 配置对象

- **filePath** (string, 必填): 图片数据，支持以下格式：
  - Base64: `data:image/jpeg;base64,...`（完整的 Data URL，推荐）
  - 网络 URL: `http://...` 或 `https://...`

## 返回值

返回 Promise，成功时 resolve，失败时 reject。

**成功时（resolve）返回：**

```javascript
undefined  // 成功时不返回任何内容，没有异常即表示成功
```

**失败时（reject）返回：**

```javascript
{
  name: 'PERMISSION_DENIED',  // 错误类型枚举（string）
  message: '权限被拒绝'  // 错误信息（string）
}
```

## 示例

**示例 1：保存 Base64 图片**

```javascript
// 从 canvas 获取 base64
const canvas = document.getElementById('myCanvas');
const base64 = canvas.toDataURL('image/jpeg', 0.9);

try {
  await window.lingguang.saveImageToPhotosAlbum({
    filePath: base64
  });
  console.log('图片已保存到相册');
} catch (error) {
  console.log('保存失败:', error.message);
}
```

**示例 2：保存从 chooseImage/takePhoto 获取的图片**

```javascript
try {
  // 从相册选择图片
  const chooseResult = await window.lingguang.chooseImage({ count: 1 });
  const imagePath = chooseResult.tempFiles[0].path;

  const { url } = await window.lingguang.uploadImage({ filePath: imagePath });
  // 使用上传后的 URL 保存到相册
  await window.lingguang.saveImageToPhotosAlbum({
    filePath: url
  });
  console.log('保存成功');
} catch (error) {
  console.log('保存失败:', error.message);
}
```

**示例 3：保存网络图片**

```javascript
try {
  await window.lingguang.saveImageToPhotosAlbum({
    filePath: 'https://example.com/photo.jpg'
  });
  console.log('保存成功');
} catch (error) {
  console.log('保存失败:', error.message);
}
```

## 注意事项

1. 需要相册写入权限，用户可能会拒绝权限请求

2. **filePath 参数格式**：
   - Base64 格式必须是完整的 Data URL（如 `data:image/jpeg;base64,/9j/4AAQ...`）
   - `chooseImage/takePhoto` 返回的路径先经 `uploadImage` 转成 URL，再用于保存
   - 网络 URL 会先下载图片再保存到相册

# window.lingguang.uploadImage

将图片上传到服务器。支持多种图片来源（本地路径、Base64、URL）。

## 函数签名

```typescript
window.lingguang.uploadImage(options: {
  filePath: string;
  compress?: 'low' | 'medium' | 'high' | 'none' | 'auto';
}): Promise<{
  url: string;
}>
```

## 参数

**options** (Object): 配置对象

- **filePath** (string, 必填): 图片数据，支持以下格式：
  - 本地路径: `file:///path/to/image.jpg`（由 chooseImage/takePhoto 返回的 path，推荐）
  - Base64: `data:image/jpeg;base64,...`（完整的 Data URL）
  - URL: `http://...` 或 `https://...`（网络图片 URL，会先下载再上传）
- **compress** (string, 可选): 压缩级别，默认值为 `'auto'`
  - `'low'`: 低质量（文件较小，质量较低）
  - `'medium'`: 中质量（平衡文件大小和质量）
  - `'high'`: 高质量（文件较大，质量较高）
  - `'none'`: 不压缩（保持原图）
  - `'auto'`: 自动选择（默认值）

## 返回值

返回 Promise，成功时 resolve，失败时 reject。

**成功时（resolve）返回：**

```javascript
{
  url: 'https://example.com/uploads/image.jpg'  // 服务器返回的图片 URL
}
```

**失败时（reject）返回：**

```javascript
{
  name: 'NETWORK_ERROR',  // 错误类型枚举（string）
  message: '网络错误'  // 错误信息（string）
}
```

## 示例

**示例 1：上传本地图片（推荐）**

```javascript
try {
  // 先选择图片
  const chooseResult = await window.lingguang.chooseImage({
    count: 1,
    sourceType: ['album']
  });

  const imagePath = chooseResult.tempFiles[0].path;

  // 上传图片
  const uploadResult = await window.lingguang.uploadImage({
    filePath: imagePath  // 使用本地路径
  });

  console.log('上传成功，图片 URL:', uploadResult.url);
} catch (error) {
  console.log('上传失败:', error.message);
}
```

**示例 2：上传 Base64 图片**

```javascript
const base64Image = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==...';

try {
  const result = await window.lingguang.uploadImage({
    filePath: base64Image
  });
  console.log('上传成功:', result.url);
} catch (error) {
  console.log('上传失败:', error.message);
}
```

## 注意事项

1. **filePath 参数格式**：
   - 本地路径（推荐）：使用 `chooseImage` 或 `takePhoto` 返回的 `path`
   - Base64 格式必须是完整的 Data URL（如 `data:image/jpeg;base64,...`）

2. **压缩参数**：
   - `compress` 参数控制上传前图片的压缩程度
   - 默认值为 `'auto'`，系统会自动选择合适的压缩级别
   - 如果图片已经很小或需要保持原图质量，可以使用 `'none'` 或 `'high'`
