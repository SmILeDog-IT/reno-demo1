import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import App from './App';
import './styles.css';

dayjs.locale('zh-cn');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#c9372c',
          borderRadius: 2,
          fontSize: 13,
          colorBorder: '#e5e6e8',
        },
        components: {
          Table: {
            headerBg: '#f7f8fa',
            headerColor: '#666',
            cellPaddingBlockSM: 7,
            cellPaddingInlineSM: 10,
          },
        },
      }}
    >
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </HashRouter>
    </ConfigProvider>
  </React.StrictMode>
);
