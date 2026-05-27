const fs = require('fs');
const path = require('path');

// Mock browser globals
const mockWindow = {
  navigator: {
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  },
  location: {
    host: "sit.xiaohongshu.com",
    protocol: "https:",
    href: "https://www.xiaohongshu.com/"
  },
  performance: {
    timeOrigin: Date.now() - 10000
  },
  localStorage: {
    getItem(key) {
      if (key === 'b1') return "I38rHdgsjopgIvesdVwgIC+oIELmBZ5e3VwXLgFTIxS3bqwErFeexd0ekncAzMFYnqthIhJeDdRxqqwdIvAsWBchwPttgm46KUzxIh0s0LKsjqwny7DZIvosxbPjyZuAIhKeDa7sfUTTJqtR+qwApdpNIChmNI8KzVwSICgekutHwqwDIEFqIE/sTIZiIxrMIvgedqwR+7pPzZNsdY3efqtAIkNe3VwgqqtpputxKzgs1WpeICVWIhQ0/PtQKVwAI3Z2omdeiqwfICAeTVtrIE++IEmncfdejgzYroosfqwOZWoedLDDBogsjZpBIxKsdVtaIkvefqwRbMLIGf4BI37sxqtE/WOex0l4IhQsIE8+QdHdIxEs8MlmIkcfbPwSICqWG7JsYlOskPwRI3KefBAed04+Ivvs3clltPt0IigeieOexmJsVuwtrnosdVtuI3VbbU6eWuwko9osSPwgI3zrI3+xoPwezPwJoaILyMos0jOsVqt8IiosdU3s6Du0IiNekjOe0lSBIv6s0qwnIvpypVwHPVtAIx5e6utvIkos3VwVIk3sjut3wutnsPwIICclI3lZ+0QjtY/eTqtjIiPqIiNeYuwKZZzrcnNsYjSuIihLwVwznPtCI35ekVwNnSdsTMKeVzSPIids6B7sTuwGpuwwICJeWVwiIkgexjRwIveeS7/efVtSI37skqwuNdRPIhHpICgsxMgeka/eYD6sYPtQIiFRIvc6cVwtIxrAIiNe3lSTKdeeDVw2IiHZLPwhPMgeSc0sWPtycVtpI3qDIiprOqt7tVwOIxvs6c6eiVw/JutfIvMn+PtXI3HItlimIk/sYMJsWrveWuwXPutWIiVIIidexPwEIC3efIkvICbnrzEaIhpeICdejPwhzqtGNut8I3PIIhes6//eVVw0JfZvIvVHpPtcrutyIkFDI3kxI3QlIv0edbosTLpeNqw/IvWApqwQNPw2IhKeDbHXIiPxGoJedVtVmutVZmWZZDifIkb1puwlIxOsV/YxIkRymqwtIk82QPtfHVtgIhhjIv8dICbPeVwXI3u2IEvs1qwhO0lWIvIVIvNsj7NsSuwCIvQ6IEVFpsHYIvMAacP1IvOsjMde6Pw9IhOsfPtSIhIHIE0sduwGIvQzruwOIC0sTWhycVtUePteICAejPtnIh0s1dq1IkveSM6eiqwnJBKeDPwZbMdexqtNI3dsxrds3VwzIib7IEuc/qtOJMinIvgs0qtrL/dsiYHIeqttI3rbIEJeYMmPI3vsYqwgIxzbIE7eDZFfIkH+IkYcPISmI37sfWpjIhHhI3WCIxdsdd+gtPtwLVwagD/eScvefPwYICNedI7skutamVwgIvQLZqtxnut2NVtA+VtV4qtUqnJeiLvsiBdskpKekutsIhGyIiHhICzCI3deV7ee1/M1KuwOIiW2nPwNGo6sVVwLICesfWOe0/GgIx0eSutJ8Wc6I3osDqtTIv6sTVw9tPtGI3defdIgQuwJesNeDLFDIidejVtn/qw3Bods3VwicPwqbPwtIvu4IkThBDOsdm6s6qtiIxeeVPwJrPwcKaeekZWRssid4W8AputZmVtoIx4iI3W2IvI1GLKsiUmaIxLoI3iqePwNIvii2VtB";
      return null;
    },
    setItem() {}
  },
  sessionStorage: {
    getItem(key) {
      if (key === 'sc') return '0';
      return null;
    },
    setItem() {}
  },
  document: {
    cookie: "a1=19d9ab8ecae0z8di5zkhpwrdal4l0gti7iflagpf630000727431",
    createElement() { return {}; },
    body: { appendChild() {} }
  }
};

mockWindow.window = mockWindow;
mockWindow.self = mockWindow;
global.window = mockWindow;
global.self = mockWindow;
global.document = mockWindow.document;
global.navigator = mockWindow.navigator;
global.localStorage = mockWindow.localStorage;
global.sessionStorage = mockWindow.sessionStorage;
global.__webpack_require__ = () => ({});

// Load the SDK pack
const sdkCode = fs.readFileSync('/Users/hyperorchid/aiwithblockchain/aihub/Spider_XHS/static/xhs_xray_pack1.js', 'utf8');

try {
  eval(sdkCode);
  console.log('mockWindow keys:', Object.keys(mockWindow).filter(k => k !== 'window' && k !== 'self' && k !== 'navigator' && k !== 'location' && k !== 'performance' && k !== 'localStorage' && k !== 'sessionStorage' && k !== 'document'));
} catch (e) {
  console.error('Failed to load SDK:', e);
}
