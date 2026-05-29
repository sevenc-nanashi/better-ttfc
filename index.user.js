// ==UserScript==
// @name         T-Two-F-C
// @version      0.2.0
// @author       Nanashi. <https://sevenc7c.com>
// @description  東映特撮ファンクラブのPC版サイトをより便利にするためのユーザースクリプト。
// @homepage     https://github.com/sevenc-nanashi/t-two-f-c
// @homepageURL  https://github.com/sevenc-nanashi/t-two-f-c
// @downloadURL  https://raw.githubusercontent.com/sevenc-nanashi/t-two-f-c/built/index.user.js
// @updateURL    https://raw.githubusercontent.com/sevenc-nanashi/t-two-f-c/built/index.user.js
// @match        https://pc.tokusatsu-fc.jp/*
// @sandbox      MAIN_WORLD
// @run-at       document-body
// ==/UserScript==

(function() {
  'use strict';
	var LogLevels = {
		silent: Number.NEGATIVE_INFINITY,
		fatal: 0,
		error: 0,
		warn: 1,
		log: 2,
		info: 3,
		success: 3,
		fail: 3,
		ready: 3,
		start: 3,
		box: 3,
		debug: 4,
		trace: 5,
		verbose: Number.POSITIVE_INFINITY
	};
	var LogTypes = {
		silent: { level: -1 },
		fatal: { level: LogLevels.fatal },
		error: { level: LogLevels.error },
		warn: { level: LogLevels.warn },
		log: { level: LogLevels.log },
		info: { level: LogLevels.info },
		success: { level: LogLevels.success },
		fail: { level: LogLevels.fail },
		ready: { level: LogLevels.info },
		start: { level: LogLevels.info },
		box: { level: LogLevels.info },
		debug: { level: LogLevels.debug },
		trace: { level: LogLevels.trace },
		verbose: { level: LogLevels.verbose }
	};
	function isPlainObject$1(value) {
		if (value === null || typeof value !== "object") return false;
		const prototype = Object.getPrototypeOf(value);
		if (prototype !== null && prototype !== Object.prototype && Object.getPrototypeOf(prototype) !== null) return false;
		if (Symbol.iterator in value) return false;
		if (Symbol.toStringTag in value) return Object.prototype.toString.call(value) === "[object Module]";
		return true;
	}
	function _defu(baseObject, defaults, namespace = ".", merger) {
		if (!isPlainObject$1(defaults)) return _defu(baseObject, {}, namespace, merger);
		const object = Object.assign({}, defaults);
		for (const key in baseObject) {
			if (key === "__proto__" || key === "constructor") continue;
			const value = baseObject[key];
			if (value === null || value === void 0) continue;
			if (merger && merger(object, key, value, namespace)) continue;
			if (Array.isArray(value) && Array.isArray(object[key])) object[key] = [...value, ...object[key]];
			else if (isPlainObject$1(value) && isPlainObject$1(object[key])) object[key] = _defu(value, object[key], (namespace ? `${namespace}.` : "") + key.toString(), merger);
			else object[key] = value;
		}
		return object;
	}
	function createDefu(merger) {
		return (...arguments_) => arguments_.reduce((p, c) => _defu(p, c, "", merger), {});
	}
	var defu = createDefu();
	function isPlainObject(obj) {
		return Object.prototype.toString.call(obj) === "[object Object]";
	}
	function isLogObj(arg) {
		if (!isPlainObject(arg)) return false;
		if (!arg.message && !arg.args) return false;
		if (arg.stack) return false;
		return true;
	}
	var paused = false;
	var queue = [];
	var Consola = class Consola {
		options;
		_lastLog;
		_mockFn;
		constructor(options = {}) {
			const types = options.types || LogTypes;
			this.options = defu({
				...options,
				defaults: { ...options.defaults },
				level: _normalizeLogLevel(options.level, types),
				reporters: [...options.reporters || []]
			}, {
				types: LogTypes,
				throttle: 1e3,
				throttleMin: 5,
				formatOptions: {
					date: true,
					colors: false,
					compact: true
				}
			});
			for (const type in types) {
				const defaults = {
					type,
					...this.options.defaults,
					...types[type]
				};
				this[type] = this._wrapLogFn(defaults);
				this[type].raw = this._wrapLogFn(defaults, true);
			}
			if (this.options.mockFn) this.mockTypes();
			this._lastLog = {};
		}
		get level() {
			return this.options.level;
		}
		set level(level) {
			this.options.level = _normalizeLogLevel(level, this.options.types, this.options.level);
		}
		prompt(message, opts) {
			if (!this.options.prompt) throw new Error("prompt is not supported!");
			return this.options.prompt(message, opts);
		}
		create(options) {
			const instance = new Consola({
				...this.options,
				...options
			});
			if (this._mockFn) instance.mockTypes(this._mockFn);
			return instance;
		}
		withDefaults(defaults) {
			return this.create({
				...this.options,
				defaults: {
					...this.options.defaults,
					...defaults
				}
			});
		}
		withTag(tag) {
			return this.withDefaults({ tag: this.options.defaults.tag ? this.options.defaults.tag + ":" + tag : tag });
		}
		addReporter(reporter) {
			this.options.reporters.push(reporter);
			return this;
		}
		removeReporter(reporter) {
			if (reporter) {
				const i = this.options.reporters.indexOf(reporter);
				if (i !== -1) return this.options.reporters.splice(i, 1);
			} else this.options.reporters.splice(0);
			return this;
		}
		setReporters(reporters) {
			this.options.reporters = Array.isArray(reporters) ? reporters : [reporters];
			return this;
		}
		wrapAll() {
			this.wrapConsole();
			this.wrapStd();
		}
		restoreAll() {
			this.restoreConsole();
			this.restoreStd();
		}
		wrapConsole() {
			for (const type in this.options.types) {
				if (!console["__" + type]) console["__" + type] = console[type];
				console[type] = this[type].raw;
			}
		}
		restoreConsole() {
			for (const type in this.options.types) if (console["__" + type]) {
				console[type] = console["__" + type];
				delete console["__" + type];
			}
		}
		wrapStd() {
			this._wrapStream(this.options.stdout, "log");
			this._wrapStream(this.options.stderr, "log");
		}
		_wrapStream(stream, type) {
			if (!stream) return;
			if (!stream.__write) stream.__write = stream.write;
			stream.write = (data) => {
				this[type].raw(String(data).trim());
			};
		}
		restoreStd() {
			this._restoreStream(this.options.stdout);
			this._restoreStream(this.options.stderr);
		}
		_restoreStream(stream) {
			if (!stream) return;
			if (stream.__write) {
				stream.write = stream.__write;
				delete stream.__write;
			}
		}
		pauseLogs() {
			paused = true;
		}
		resumeLogs() {
			paused = false;
			const _queue = queue.splice(0);
			for (const item of _queue) item[0]._logFn(item[1], item[2]);
		}
		mockTypes(mockFn) {
			const _mockFn = mockFn || this.options.mockFn;
			this._mockFn = _mockFn;
			if (typeof _mockFn !== "function") return;
			for (const type in this.options.types) {
				this[type] = _mockFn(type, this.options.types[type]) || this[type];
				this[type].raw = this[type];
			}
		}
		_wrapLogFn(defaults, isRaw) {
			return (...args) => {
				if (paused) {
					queue.push([
						this,
						defaults,
						args,
						isRaw
					]);
					return;
				}
				return this._logFn(defaults, args, isRaw);
			};
		}
		_logFn(defaults, args, isRaw) {
			if ((defaults.level || 0) > this.level) return false;
			const logObj = {
				date: new Date(),
				args: [],
				...defaults,
				level: _normalizeLogLevel(defaults.level, this.options.types)
			};
			if (!isRaw && args.length === 1 && isLogObj(args[0])) Object.assign(logObj, args[0]);
			else logObj.args = [...args];
			if (logObj.message) {
				logObj.args.unshift(logObj.message);
				delete logObj.message;
			}
			if (logObj.additional) {
				if (!Array.isArray(logObj.additional)) logObj.additional = logObj.additional.split("\n");
				logObj.args.push("\n" + logObj.additional.join("\n"));
				delete logObj.additional;
			}
			logObj.type = typeof logObj.type === "string" ? logObj.type.toLowerCase() : "log";
			logObj.tag = typeof logObj.tag === "string" ? logObj.tag : "";
			const resolveLog = (newLog = false) => {
				const repeated = (this._lastLog.count || 0) - this.options.throttleMin;
				if (this._lastLog.object && repeated > 0) {
					const args2 = [...this._lastLog.object.args];
					if (repeated > 1) args2.push(`(repeated ${repeated} times)`);
					this._log({
						...this._lastLog.object,
						args: args2
					});
					this._lastLog.count = 1;
				}
				if (newLog) {
					this._lastLog.object = logObj;
					this._log(logObj);
				}
			};
			clearTimeout(this._lastLog.timeout);
			const diffTime = this._lastLog.time && logObj.date ? logObj.date.getTime() - this._lastLog.time.getTime() : 0;
			this._lastLog.time = logObj.date;
			if (diffTime < this.options.throttle) try {
				const serializedLog = JSON.stringify([
					logObj.type,
					logObj.tag,
					logObj.args
				]);
				const isSameLog = this._lastLog.serialized === serializedLog;
				this._lastLog.serialized = serializedLog;
				if (isSameLog) {
					this._lastLog.count = (this._lastLog.count || 0) + 1;
					if (this._lastLog.count > this.options.throttleMin) {
						this._lastLog.timeout = setTimeout(resolveLog, this.options.throttle);
						return;
					}
				}
			} catch {}
			resolveLog(true);
		}
		_log(logObj) {
			for (const reporter of this.options.reporters) reporter.log(logObj, { options: this.options });
		}
	};
	function _normalizeLogLevel(input, types = {}, defaultLevel = 3) {
		if (input === void 0) return defaultLevel;
		if (typeof input === "number") return input;
		if (types[input] && types[input].level !== void 0) return types[input].level;
		return defaultLevel;
	}
	Consola.prototype.add = Consola.prototype.addReporter;
	Consola.prototype.remove = Consola.prototype.removeReporter;
	Consola.prototype.clear = Consola.prototype.removeReporter;
	Consola.prototype.withScope = Consola.prototype.withTag;
	Consola.prototype.mock = Consola.prototype.mockTypes;
	Consola.prototype.pause = Consola.prototype.pauseLogs;
	Consola.prototype.resume = Consola.prototype.resumeLogs;
	function createConsola$1(options = {}) {
		return new Consola(options);
	}
	var BrowserReporter = class {
		options;
		defaultColor;
		levelColorMap;
		typeColorMap;
		constructor(options) {
			this.options = { ...options };
			this.defaultColor = "#7f8c8d";
			this.levelColorMap = {
				0: "#c0392b",
				1: "#f39c12",
				3: "#00BCD4"
			};
			this.typeColorMap = { success: "#2ecc71" };
		}
		_getLogFn(level) {
			if (level < 1) return console.__error || console.error;
			if (level === 1) return console.__warn || console.warn;
			return console.__log || console.log;
		}
		log(logObj) {
			const consoleLogFn = this._getLogFn(logObj.level);
			const type = logObj.type === "log" ? "" : logObj.type;
			const tag = logObj.tag || "";
			const style = `
      background: ${this.typeColorMap[logObj.type] || this.levelColorMap[logObj.level] || this.defaultColor};
      border-radius: 0.5em;
      color: white;
      font-weight: bold;
      padding: 2px 0.5em;
    `;
			const badge = `%c${[tag, type].filter(Boolean).join(":")}`;
			if (typeof logObj.args[0] === "string") consoleLogFn(`${badge}%c ${logObj.args[0]}`, style, "", ...logObj.args.slice(1));
			else consoleLogFn(badge, style, ...logObj.args);
		}
	};
	function createConsola(options = {}) {
		return createConsola$1({
			reporters: options.reporters || [new BrowserReporter({})],
			prompt(message, options2 = {}) {
				if (options2.type === "confirm") return Promise.resolve(confirm(message));
				return Promise.resolve(prompt(message));
			},
			...options
		});
	}
	var baseLogger = createConsola().withTag("T-Two-FC");
	function matchUrl(path, pattern) {
		return new RegExp(`^${pattern.replaceAll(".", "\\.").replaceAll("*", ".*")}(?:\\?.*)?$`).test(path);
	}
	function maybeGetElementsBySelector(selector, from = document) {
		return Array.from(from.querySelectorAll(selector));
	}
	function getElementsBySelector(selector, from = document) {
		const elements = maybeGetElementsBySelector(selector, from);
		if (elements.length === 0) throw new Error(`No elements found for selector: ${selector}`);
		return elements;
	}
	function maybeGetElementBySelector(selector, from = document) {
		return from.querySelector(selector);
	}
	function getElementBySelector(selector, from = document) {
		const element = maybeGetElementBySelector(selector, from);
		if (!element) throw new Error(`No element found for selector: ${selector}`);
		return element;
	}
	function insertStyle(css) {
		const style = document.createElement("style");
		style.textContent = css;
		document.head.appendChild(style);
		return () => {
			if (style.parentElement) style.parentElement.removeChild(style);
		};
	}
	var modLogger$1 = baseLogger.withTag("episodes");
	async function replaceEpisodeNames() {
		const logger = modLogger$1.withTag("replaceEpisodeNames");
		logger.log("Setting up episode name replacement hook");
		const episodeNames = getElementsBySelector(":scope > div > .font-semibold > .text-ttfc-white", getElementBySelector("div:has(#tracking-content-id) > .pb-12 > .px-6 div.grid-cols-5"));
		if (episodeNames.some((name) => !name.textContent?.trim().match(/^第[0-9]+話$/))) {
			logger.log("Episode names are already present, skipping hook setup");
			return;
		}
		logger.log("Episode names are missing, replacing with API data");
		const contentTitle = getElementBySelector("#tracking-content-title").getAttribute("value");
		const episodes = await fetch(`https://t-two-f-c-api.sevenc7c.workers.dev/episodes?name=${encodeURIComponent(contentTitle ?? "")}`);
		if (!episodes.ok) {
			logger.warn(`Failed to fetch episode names from API: ${episodes.status} ${episodes.statusText}, skipping replacement`);
			return;
		}
		const episodesData = await episodes.json();
		for (const episodeNameElement of episodeNames) {
			const text = episodeNameElement.textContent?.trim();
			if (!text || !text.match(/^第[0-9]+話$/)) continue;
			const episodeNumberMatch = text.match(/^第([0-9]+)話$/);
			if (!episodeNumberMatch) {
				logger.warn(`Failed to parse episode number from text: "${text}", skipping element`);
				continue;
			}
			const episodeNumber = parseInt(episodeNumberMatch[1], 10);
			const apiEpisode = episodesData.episodes.find((e) => e.episodeNumber === episodeNumber);
			if (!apiEpisode) {
				logger.warn(`Could not find episode data for episode number ${episodeNumber}, skipping element`);
				continue;
			}
			episodeNameElement.textContent = `第${apiEpisode.episodeNumber}話 ${apiEpisode.title}`;
			logger.log(`Replaced episode name for episode number ${episodeNumber} with title: "${apiEpisode.title}"`);
			const hoverEpiosdeNameElement = episodeNameElement.parentElement?.parentElement?.querySelector(".pointer-events-none > .text-ttfc-white");
			if (hoverEpiosdeNameElement) {
				hoverEpiosdeNameElement.textContent = `第${apiEpisode.episodeNumber}話 ${apiEpisode.title}`;
				logger.log(`Also replaced hover episode name for episode number ${episodeNumber} with title: "${apiEpisode.title}"`);
			}
		}
	}
	async function main$2(path) {
		if (!matchUrl(path, "/movies/*/movie-stories") && !matchUrl(path, "/movies/*/movie-stories/*")) return;
		await replaceEpisodeNames();
	}
	var protoOf = Object.getPrototypeOf;
	var changedStates, derivedStates, curDeps, curNewDerives, alwaysConnectedDom = { isConnected: 1 };
	var gcCycleInMs = 1e3, statesToGc, propSetterCache = {};
	var objProto = protoOf(alwaysConnectedDom), funcProto = protoOf(protoOf), _undefined;
	var addAndScheduleOnFirst = (set, s, f, waitMs) => (set ?? (waitMs ? setTimeout(f, waitMs) : queueMicrotask(f), new Set())).add(s);
	var runAndCaptureDeps = (f, deps, arg) => {
		let prevDeps = curDeps;
		curDeps = deps;
		try {
			return f(arg);
		} catch (e) {
			console.error(e);
			return arg;
		} finally {
			curDeps = prevDeps;
		}
	};
	var keepConnected = (l) => l.filter((b) => b._dom?.isConnected);
	var addStatesToGc = (d) => statesToGc = addAndScheduleOnFirst(statesToGc, d, () => {
		for (let s of statesToGc) s._bindings = keepConnected(s._bindings), s._listeners = keepConnected(s._listeners);
		statesToGc = _undefined;
	}, gcCycleInMs);
	var stateProto = {
		get val() {
			curDeps?._getters?.add(this);
			return this.rawVal;
		},
		get oldVal() {
			curDeps?._getters?.add(this);
			return this._oldVal;
		},
		set val(v) {
			curDeps?._setters?.add(this);
			if (v !== this.rawVal) {
				this.rawVal = v;
				this._bindings.length + this._listeners.length ? (derivedStates?.add(this), changedStates = addAndScheduleOnFirst(changedStates, this, updateDoms)) : this._oldVal = v;
			}
		}
	};
	var state = (initVal) => ({
		__proto__: stateProto,
		rawVal: initVal,
		_oldVal: initVal,
		_bindings: [],
		_listeners: []
	});
	var bind = (f, dom) => {
		let deps = {
			_getters: new Set(),
			_setters: new Set()
		}, binding = { f }, prevNewDerives = curNewDerives;
		curNewDerives = [];
		let newDom = runAndCaptureDeps(f, deps, dom);
		newDom = (newDom ?? document).nodeType ? newDom : new Text(newDom);
		for (let d of deps._getters) deps._setters.has(d) || (addStatesToGc(d), d._bindings.push(binding));
		for (let l of curNewDerives) l._dom = newDom;
		curNewDerives = prevNewDerives;
		return binding._dom = newDom;
	};
	var derive = (f, s = state(), dom) => {
		let deps = {
			_getters: new Set(),
			_setters: new Set()
		}, listener = {
			f,
			s
		};
		listener._dom = dom ?? curNewDerives?.push(listener) ?? alwaysConnectedDom;
		s.val = runAndCaptureDeps(f, deps, s.rawVal);
		for (let d of deps._getters) deps._setters.has(d) || (addStatesToGc(d), d._listeners.push(listener));
		return s;
	};
	var add = (dom, ...children) => {
		for (let c of children.flat(Infinity)) {
			let protoOfC = protoOf(c ?? 0);
			let child = protoOfC === stateProto ? bind(() => c.val) : protoOfC === funcProto ? bind(c) : c;
			child != _undefined && dom.append(child);
		}
		return dom;
	};
	var tag = (ns, name, ...args) => {
		let [{ is, ...props }, ...children] = protoOf(args[0] ?? 0) === objProto ? args : [{}, ...args];
		let dom = ns ? document.createElementNS(ns, name, { is }) : document.createElement(name, { is });
		for (let [k, v] of Object.entries(props)) {
			let getPropDescriptor = (proto) => proto ? Object.getOwnPropertyDescriptor(proto, k) ?? getPropDescriptor(protoOf(proto)) : _undefined;
			let cacheKey = name + "," + k;
			let propSetter = propSetterCache[cacheKey] ??= getPropDescriptor(protoOf(dom))?.set ?? 0;
			let setter = k.startsWith("on") ? (v, oldV) => {
				let event = k.slice(2);
				dom.removeEventListener(event, oldV);
				dom.addEventListener(event, v);
			} : propSetter ? propSetter.bind(dom) : dom.setAttribute.bind(dom, k);
			let protoOfV = protoOf(v ?? 0);
			k.startsWith("on") || protoOfV === funcProto && (v = derive(v), protoOfV = stateProto);
			protoOfV === stateProto ? bind(() => (setter(v.val, v._oldVal), dom)) : setter(v);
		}
		return add(dom, children);
	};
	var handler = (ns) => ({ get: (_, name) => tag.bind(_undefined, ns, name) });
	var update = (dom, newDom) => newDom ? newDom !== dom && dom.replaceWith(newDom) : dom.remove();
	var updateDoms = () => {
		let iter = 0, derivedStatesArray = [...changedStates].filter((s) => s.rawVal !== s._oldVal);
		do {
			derivedStates = new Set();
			for (let l of new Set(derivedStatesArray.flatMap((s) => s._listeners = keepConnected(s._listeners)))) derive(l.f, l.s, l._dom), l._dom = _undefined;
		} while (++iter < 100 && (derivedStatesArray = [...derivedStates]).length);
		let changedStatesArray = [...changedStates].filter((s) => s.rawVal !== s._oldVal);
		changedStates = _undefined;
		for (let b of new Set(changedStatesArray.flatMap((s) => s._bindings = keepConnected(s._bindings)))) update(b._dom, bind(b.f, b._dom)), b._dom = _undefined;
		for (let s of changedStatesArray) s._oldVal = s.rawVal;
	};
	var { button, p, div } = {
		tags: new Proxy((ns) => new Proxy(tag, handler(ns)), handler()),
		hydrate: (dom, f) => update(dom, bind(f, dom)),
		add,
		state,
		derive
	}.tags;
	var modLogger = baseLogger.withTag("watch");
	function toggleFullscreen() {
		getElementBySelector("main").classList.toggle("bttfc-using-browser-fullscreen-mode");
	}
	function addKeyboardShortcuts() {
		const logger = modLogger.withTag("addKeyboardShortcuts");
		logger.log("Adding keyboard shortcuts to video.js players");
		const moviePlayer = getElementBySelector("#player-wrapper");
		moviePlayer.addEventListener("keydown", onKeyDown);
		moviePlayer.setAttribute("tabindex", "0");
		function onKeyDown(event) {
			const video = getElementBySelector("#player-video_html5_api", moviePlayer);
			if (event.code === "ArrowRight") {
				logger.log("Seeking forward 10 seconds");
				event.preventDefault();
				video.currentTime += 10;
			} else if (event.code === "ArrowLeft") {
				logger.log("Seeking backward 10 seconds");
				event.preventDefault();
				video.currentTime -= 10;
			} else if (event.code === "ArrowUp") {
				logger.log("Increasing volume by 10%");
				event.preventDefault();
				video.volume = Math.min(video.volume + .1, 1);
			} else if (event.code === "ArrowDown") {
				logger.log("Decreasing volume by 10%");
				event.preventDefault();
				video.volume = Math.max(video.volume - .1, 0);
			} else if (event.code === "Space") {
				logger.log("Toggling play/pause");
				event.preventDefault();
				if (video.paused) video.play();
				else video.pause();
			} else if (event.code === "KeyF") {
				logger.log("Toggling fullscreen");
				event.preventDefault();
				getElementBySelector(".vjs-fullscreen-control").click();
			} else if (event.code === "KeyT") {
				logger.log("Toggling browser fullscreen mode");
				event.preventDefault();
				toggleFullscreen();
			} else if (event.code === "KeyM") {
				logger.log("Toggling mute");
				event.preventDefault();
				getElementBySelector(".vjs-mute-control").click();
			}
		}
	}
	function addTheaterModeButton() {
		const logger = modLogger.withTag("addTheaterModeButton");
		if (document.querySelector(".bttfc-browser-fullscreen-mode-button")) return;
		const fullscreenBtn = maybeGetElementBySelector("#player-fullscreen-btn");
		if (!fullscreenBtn) return;
		const controlBar = fullscreenBtn.parentElement;
		if (!controlBar) {
			logger.warn("Fullscreen button does not have a parent element, cannot add theater mode button");
			return;
		}
		const browserFullscreenModeButton = button({
			type: "button",
			class: "transition-[opacity] relative group",
			id: "player-browser-fullscreen-btn",
			onclick: () => {
				toggleFullscreen();
			}
		}, p({
			id: "player-fullscreen-label",
			class: "opacity-0 group-hover:opacity-100 [.is-skip-visible_&]:!opacity-0 text-xs px-2 py-1 absolute top-[calc(100%+8px)] right-0 bg-ttfc-black/90 rounded-sm whitespace-nowrap duration-300 pointer-events-none"
		}, "ブラウザ拡大"), div({
			type: "button",
			"aria-disabled": "false",
			title: "Toggle Browser Fullscreen Mode",
			class: "w-6 h-6 group-hover:opacity-60 duration-300"
		}, div({
			class: "vjs-icon-picture-in-picture-exit",
			style: "top: 6px; position: relative;"
		})));
		controlBar.insertBefore(browserFullscreenModeButton, fullscreenBtn);
		controlBar.classList.add("bttfc-browser-fullscreen-mode-button");
		logger.log("Added browser fullscreen mode button to control bar");
	}
	function addBrowserFullscreenModeLoop() {
		const observer = new MutationObserver(() => {
			addTheaterModeButton();
		});
		observer.observe(document.body, {
			childList: true,
			subtree: true
		});
		return () => {
			observer.disconnect();
		};
	}
	async function replaceTitle() {
		const logger = modLogger.withTag("replaceTitle");
		const originalTitleElement = getElementBySelector("h1.text-ttfc-white", getElementBySelector("div:has(#player-wrapper)"));
		const episodeNumberMatch = originalTitleElement.textContent?.trim().match(/^第([0-9]+)話$/);
		if (!episodeNumberMatch) {
			logger.info("Original title has proper episode name, skipping title replacement");
			return;
		}
		const episodeNumber = parseInt(episodeNumberMatch[1], 10);
		const seriesTitle = getElementBySelector("#tracking-content-title").getAttribute("value") ?? "";
		const response = await fetch(`https://t-two-f-c-api.sevenc7c.workers.dev/episodes?name=${encodeURIComponent(seriesTitle)}`);
		if (!response.ok) {
			logger.warn(`Failed to fetch episode names from API: ${response.status} ${response.statusText}, skipping title replacement`);
			return;
		}
		const episodeData = (await response.json()).episodes.find((e) => e.episodeNumber === episodeNumber);
		if (!episodeData) {
			logger.warn(`Could not find episode data for episode number ${episodeNumber}, skipping title replacement`);
			return;
		}
		originalTitleElement.textContent = `第${episodeData.episodeNumber}話 ${episodeData.title}`;
		logger.log(`Replaced title with episode name: "${episodeData.title}"`);
	}
	async function main$1(path) {
		if (!matchUrl(path, "/movies/*/movie-stories/*")) return;
		addKeyboardShortcuts();
		addBrowserFullscreenModeLoop();
		replaceTitle();
		insertStyle(`
    .bttfc-using-browser-fullscreen-mode #player-wrapper {
      background: #000;
      position:fixed !important;
      inset: 0;
      width: 100vw;
      height: 100vh;
      z-index:999;
    }
  `);
	}
	var mains = Object.assign({
		"./pages/episodes.ts": main$2,
		"./pages/watch.ts": main$1
	});
	async function callPageMains(path) {
		const logger = baseLogger.withTag("callPageMains");
		logger.log("Navigation detected, calling scripts for path:", path);
		for (const [filePath, mainFunc] of Object.entries(mains)) try {
			await mainFunc(path);
			logger.log(`Successfully called main function from ${filePath}`);
		} catch (error) {
			logger.error(`Error calling main function from ${filePath}:`, error);
		}
	}
	async function main() {
		baseLogger.log("Started");
		await callPageMains(location.pathname);
	}
	main();
})();
