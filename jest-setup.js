// Jest setup provided by Grafana scaffolding
import './.config/jest-setup';
import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, { TextDecoder, TextEncoder });
