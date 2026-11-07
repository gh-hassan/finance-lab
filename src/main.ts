import './styles/main.css';
import './modules/m1.js';
import './modules/m2.js';
import './modules/m3.js';
import './modules/m4.js';
import './modules/m5.js';
import './modules/m6.js';
import './modules/m7.js';
import './ui/beginner2.js';
import { startApp } from './ui/shell.js';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
startApp(root);
