/*
 * Copyright 2026 Cai Frazier
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Enum Codification Tests (Atlas v1.0 Enhancement #7)
 * 
 * Validates enum type guards and const enum objects.
 */

import { describe, test, expect } from 'vitest';
import {
  RenderMode,
  isRenderMode,
  NavEndReason,
  isNavEndReason,
  EdgeLocation,
  isEdgeLocation,
  ParamPolicy,
  isParamPolicy,
  CrawlState,
  isCrawlState
} from '../src/types.js';

describe('RenderMode enum', () => {
  test('const enum object has correct values', () => {
    expect(RenderMode.RAW).toBe('raw');
    expect(RenderMode.IMPORT).toBe('import');
    expect(RenderMode.PRERENDER).toBe('prerender');
    expect(RenderMode.FULL).toBe('full');
    expect(RenderMode.values).toEqual(['raw', 'import', 'prerender', 'full']);
  });

  test('isRenderMode validates correct values', () => {
    expect(isRenderMode('raw')).toBe(true);
    expect(isRenderMode('import')).toBe(true);
    expect(isRenderMode('prerender')).toBe(true);
    expect(isRenderMode('full')).toBe(true);
  });

  test('isRenderMode rejects invalid values', () => {
    expect(isRenderMode('invalid')).toBe(false);
    expect(isRenderMode('')).toBe(false);
    expect(isRenderMode('RAW')).toBe(false); // Case sensitive
    expect(isRenderMode(123)).toBe(false);
    expect(isRenderMode(null)).toBe(false);
    expect(isRenderMode(undefined)).toBe(false);
  });

  test('descriptions are available', () => {
    expect(RenderMode.descriptions.raw).toBeTruthy();
    expect(RenderMode.descriptions.prerender).toBeTruthy();
    expect(RenderMode.descriptions.full).toBeTruthy();
  });
});

describe('NavEndReason enum', () => {
  test('const enum object has correct values', () => {
    expect(NavEndReason.FETCH).toBe('fetch');
    expect(NavEndReason.LOAD).toBe('load');
    expect(NavEndReason.NETWORKIDLE).toBe('networkidle');
    expect(NavEndReason.TIMEOUT).toBe('timeout');
    expect(NavEndReason.ERROR).toBe('error');
    expect(NavEndReason.values).toEqual(['fetch', 'load', 'networkidle', 'timeout', 'error']);
  });

  test('isNavEndReason validates correct values', () => {
    expect(isNavEndReason('fetch')).toBe(true);
    expect(isNavEndReason('load')).toBe(true);
    expect(isNavEndReason('networkidle')).toBe(true);
    expect(isNavEndReason('timeout')).toBe(true);
    expect(isNavEndReason('error')).toBe(true);
  });

  test('isNavEndReason rejects invalid values', () => {
    expect(isNavEndReason('domcontentloaded')).toBe(false); // Old value
    expect(isNavEndReason('invalid')).toBe(false);
    expect(isNavEndReason('')).toBe(false);
    expect(isNavEndReason(null)).toBe(false);
  });

  test('descriptions are available', () => {
    expect(NavEndReason.descriptions.fetch).toBeTruthy();
    expect(NavEndReason.descriptions.load).toBeTruthy();
    expect(NavEndReason.descriptions.networkidle).toBeTruthy();
  });
});

describe('EdgeLocation enum', () => {
  test('const enum object has correct values', () => {
    expect(EdgeLocation.NAV).toBe('nav');
    expect(EdgeLocation.HEADER).toBe('header');
    expect(EdgeLocation.FOOTER).toBe('footer');
    expect(EdgeLocation.ASIDE).toBe('aside');
    expect(EdgeLocation.MAIN).toBe('main');
    expect(EdgeLocation.OTHER).toBe('other');
    expect(EdgeLocation.UNKNOWN).toBe('unknown');
    expect(EdgeLocation.values).toEqual(['nav', 'header', 'footer', 'aside', 'main', 'other', 'unknown']);
  });

  test('isEdgeLocation validates correct values', () => {
    expect(isEdgeLocation('nav')).toBe(true);
    expect(isEdgeLocation('header')).toBe(true);
    expect(isEdgeLocation('footer')).toBe(true);
    expect(isEdgeLocation('aside')).toBe(true);
    expect(isEdgeLocation('main')).toBe(true);
    expect(isEdgeLocation('other')).toBe(true);
    expect(isEdgeLocation('unknown')).toBe(true);
  });

  test('isEdgeLocation rejects invalid values', () => {
    expect(isEdgeLocation('sidebar')).toBe(false);
    expect(isEdgeLocation('body')).toBe(false);
    expect(isEdgeLocation('')).toBe(false);
  });

  test('descriptions are available', () => {
    expect(EdgeLocation.descriptions.nav).toBeTruthy();
    expect(EdgeLocation.descriptions.header).toBeTruthy();
    expect(EdgeLocation.descriptions.footer).toBeTruthy();
  });
});

describe('ParamPolicy enum', () => {
  test('const enum object has correct values', () => {
    expect(ParamPolicy.SAMPLE).toBe('sample');
    expect(ParamPolicy.STRIP).toBe('strip');
    expect(ParamPolicy.KEEP).toBe('keep');
    expect(ParamPolicy.values).toEqual(['sample', 'strip', 'keep']);
  });

  test('isParamPolicy validates correct values', () => {
    expect(isParamPolicy('sample')).toBe(true);
    expect(isParamPolicy('strip')).toBe(true);
    expect(isParamPolicy('keep')).toBe(true);
  });

  test('isParamPolicy rejects invalid values', () => {
    expect(isParamPolicy('remove')).toBe(false);
    expect(isParamPolicy('ignore')).toBe(false);
    expect(isParamPolicy('')).toBe(false);
  });

  test('descriptions are available', () => {
    expect(ParamPolicy.descriptions.sample).toBeTruthy();
    expect(ParamPolicy.descriptions.strip).toBeTruthy();
    expect(ParamPolicy.descriptions.keep).toBeTruthy();
  });
});

describe('CrawlState enum', () => {
  test('const enum object has correct values', () => {
    expect(CrawlState.IDLE).toBe('idle');
    expect(CrawlState.RUNNING).toBe('running');
    expect(CrawlState.PAUSED).toBe('paused');
    expect(CrawlState.CANCELING).toBe('canceling');
    expect(CrawlState.FINALIZING).toBe('finalizing');
    expect(CrawlState.DONE).toBe('done');
    expect(CrawlState.FAILED).toBe('failed');
    expect(CrawlState.values).toEqual(['idle', 'running', 'paused', 'canceling', 'finalizing', 'done', 'failed']);
  });

  test('isCrawlState validates correct values', () => {
    expect(isCrawlState('idle')).toBe(true);
    expect(isCrawlState('running')).toBe(true);
    expect(isCrawlState('paused')).toBe(true);
    expect(isCrawlState('canceling')).toBe(true);
    expect(isCrawlState('finalizing')).toBe(true);
    expect(isCrawlState('done')).toBe(true);
    expect(isCrawlState('failed')).toBe(true);
  });

  test('isCrawlState rejects invalid values', () => {
    expect(isCrawlState('active')).toBe(false);
    expect(isCrawlState('complete')).toBe(false);
    expect(isCrawlState('')).toBe(false);
  });

  test('descriptions are available', () => {
    expect(CrawlState.descriptions.idle).toBeTruthy();
    expect(CrawlState.descriptions.running).toBeTruthy();
    expect(CrawlState.descriptions.done).toBeTruthy();
  });
});

describe('Type compatibility', () => {
  test('enum values are assignable to their types', () => {
    // These should compile without errors
    const mode: typeof RenderMode.values[number] = 'raw';
    const reason: typeof NavEndReason.values[number] = 'load';
    const location: typeof EdgeLocation.values[number] = 'nav';
    const policy: typeof ParamPolicy.values[number] = 'keep';
    const state: typeof CrawlState.values[number] = 'running';

    expect(mode).toBe('raw');
    expect(reason).toBe('load');
    expect(location).toBe('nav');
    expect(policy).toBe('keep');
    expect(state).toBe('running');
  });
});
