'use strict';

define('admin/extend/plugins', [
	'translator',
	'benchpress',
	'bootbox',
	'alerts',
	'jquery-ui/widgets/sortable',
], function (translator, Benchpress, bootbox, alerts) {
	const Plugins = {};

	// helper functions
	function handleNoPluginsFound(pluginsList) {
		translator.translate('<li><p><i>[[admin/extend/plugins:none-found]]</i></p></li>', function (html) {
			pluginsList.append(html);
		});
	}

	function toggleActivate(pluginID, pluginEl, btn, pluginData) {
		console.log('YININGHE');
		socket.emit('admin.plugins.toggleActive', pluginID, function (err, status) {
			if (err) {
				return alerts.error(err);
			}
			btn.siblings('[data-action="toggleActive"]').removeClass('hidden');
			btn.addClass('hidden');

			// clone it to active plugins tab
			if (status.active && !$('#active [id="' + pluginID + '"]').length) {
				$('#active ul').prepend(pluginEl.clone(true));
			}

			// Toggle active state in template data
			pluginData.active = !pluginData.active;

			alerts.alert({
				alert_id: 'plugin_toggled',
				title: '[[admin/extend/plugins:alert.' + (status.active ? 'enabled' : 'disabled') + ']]',
				message: '[[admin/extend/plugins:alert.' + (status.active ? 'activate-success' : 'deactivate-success') + ']]',
				type: status.active ? 'warning' : 'success',
				timeout: 5000,
				clickfn: rebuildAndRestart,
			});
		});
	}

	function handlePluginActivation(pluginData, pluginID, pluginEl, btn) {
		console.log('YININGHE');
		if (pluginData.license && pluginData.active !== true) {
			renderLicenseDialog(pluginData, () => toggleActivate(pluginID, pluginEl, btn, pluginData));
		} else {
			toggleActivate(pluginID, pluginEl, btn, pluginData);
		}
	}

	function renderLicenseDialog(pluginData, toggleActivate) {
		console.log('YININGHE');
		Benchpress.render('admin/partials/plugins/license', pluginData).then(function (html) {
			bootbox.dialog({
				title: '[[admin/extend/plugins:license.title]]',
				message: html,
				size: 'large',
				buttons: {
					cancel: {
						label: '[[modules:bootbox.cancel]]',
						className: 'btn-link',
					},
					save: {
						label: '[[modules:bootbox.confirm]]',
						className: 'btn-primary',
						callback: toggleActivate,
					},
				},
				onShown: function () {
					const saveEl = this.querySelector('button.btn-primary');
					if (saveEl) {
						saveEl.focus();
					}
				},
			});
		});
	}

	function handleInstallError(err, pluginID, btn) {
		console.log('YININGHE');
		const errorMessage = translator.compile(
			'admin/extend/plugins:alert.suggest-error',
			err.status,
			err.responseText
		);

		bootbox.confirm(errorMessage, function (confirm) {
			if (confirm) {
				Plugins.toggleInstall(pluginID, 'latest');
			} else {
				btn.removeAttr('disabled');
			}
		});
	}

	function handleInstallSuccess(payload, pluginID, btn) {
		console.log('YININGHE');
		if (payload.version !== 'latest') {
			Plugins.toggleInstall(pluginID, payload.version);
		} else {
			confirmInstall(pluginID, function (confirm) {
				if (confirm) {
					Plugins.toggleInstall(pluginID, 'latest');
				} else {
					btn.removeAttr('disabled');
				}
			});
		}
	}

	function processPluginSuggestion(pluginID, btn) {
		console.log('YININGHE');
		Plugins.suggest(pluginID, function (err, payload) {
			if (err) {
				handleInstallError(err, pluginID, btn);
				return;
			}
			handleInstallSuccess(payload, pluginID, btn);
		});
	}

	function toggleInstallButtonAction(button) {
		console.log('YININGHE');
		const btn = $(button);
		btn.attr('disabled', true);
		const pluginID = btn.parents('li').attr('data-plugin-id');

		if (btn.attr('data-installed') === '1') {
			Plugins.toggleInstall(pluginID, btn.parents('li').attr('data-version'));
		} else {
			processPluginSuggestion(pluginID, btn);
		}
	}

	function handleUpgradeError() {
		bootbox.alert('[[admin/extend/plugins:alert.package-manager-unreachable]]');
	}

	function handleUpgradeConfirmation(pluginID, btn, version) {
		confirmInstall(pluginID, function () {
			upgrade(pluginID, btn, version);
		});
	}

	function handleUpgradeComparison(compareVersions, payload, currentVersion, pluginID, btn) {
		if (payload.version !== 'latest' && compareVersions.compare(payload.version, currentVersion, '>')) {
			upgrade(pluginID, btn, payload.version);
		} else if (payload.version === 'latest') {
			handleUpgradeConfirmation(pluginID, btn, payload.version);
		} else {
			bootbox.alert(
				translator.compile(
					'admin/extend/plugins:alert.incompatible',
					app.config.version,
					payload.version
				)
			);
		}
	}

	function handleUpgradePayload(pluginID, btn, payload, parent) {
		require(['compare-versions'], function (compareVersions) {
			const currentVersion = parent.find('.currentVersion').text();
			handleUpgradeComparison(compareVersions, payload, currentVersion, pluginID, btn);
		});
	}

	function processUpgrade(pluginID, btn, parent) {
		Plugins.suggest(pluginID, function (err, payload) {
			if (err) {
				handleUpgradeError();
				return;
			}
			handleUpgradePayload(pluginID, btn, payload, parent);
		});
	}

	function toggleUpgradeButtonAction(button) {
		const btn = $(button);
		const parent = btn.parents('li');
		const pluginID = parent.attr('data-plugin-id');

		processUpgrade(pluginID, btn, parent);
	}

	function filterAndUpdatePlugins(searchInputEl) {
		console.log('YININGHE');
		$(searchInputEl).on('input propertychange', function () {
			const term = $(this).val();
			filterPlugins(term);
			updateTabVisibility();
		});
	}

	function filterPlugins(term) {
		$('.plugins li').each(function () {
			const pluginId = $(this).attr('data-plugin-id');
			$(this).toggleClass('hide', pluginId && pluginId.indexOf(term) === -1);
		});
	}

	function updateTabVisibility() {
		const tabEls = document.querySelectorAll('.plugins .tab-pane');
		tabEls.forEach((tabEl) => {
			const remaining = tabEl.querySelectorAll('li:not(.hide)').length;
			const noticeEl = tabEl.querySelector('.no-plugins');
			if (noticeEl) {
				noticeEl.classList.toggle('hide', remaining !== 0);
			}
		});
	}

	function setupPluginUsageToggle(selector) {
		$(selector).on('click', function () {
			const usageSetting = $(this).prop('checked') ? '1' : '0';
			submitPluginUsage(usageSetting);
		});
	}

	function submitPluginUsage(value) {
		socket.emit('admin.config.setMultiple', { submitPluginUsage: value }, function (err) {
			if (err) {
				alerts.error(err);
			}
		});
	}

	function setupPluginOrderModal(selector, modalSelector, pluginListSelector) {
		$(selector).on('click', function () {
			$(modalSelector).modal('show');
			fetchActivePlugins(pluginListSelector);
		});
	}

	function fetchActivePlugins(pluginListSelector) {
		socket.emit('admin.plugins.getActive', function (err, activePlugins) {
			if (err) {
				return alerts.error(err);
			}
			renderPluginOrderList(activePlugins, pluginListSelector);
		});
	}

	function renderPluginOrderList(activePlugins, pluginListSelector) {
		let html = '';
		activePlugins.forEach((plugin) => {
			html += `
				<li class="d-flex justify-content-between gap-1 pointer border-bottom pb-2" data-plugin="${plugin}">
					${plugin}
					<div class="d-flex gap-1">
						<div class="btn-ghost-sm move-up"><i class="fa fa-chevron-up"></i></div>
						<div class="btn-ghost-sm move-down"><i class="fa fa-chevron-down"></i></div>
					</div>
				</li>
			`;
		});

		const list = $(pluginListSelector);
		if (!activePlugins.length) {
			translator.translate('[[admin/extend/plugins:none-active]]', function (text) {
				list.html(text).sortable();
			});
		} else {
			list.html(html).sortable();
			setupMoveHandlers(list);
		}
	}

	function setupMoveHandlers(list) {
		list.find('.move-up').on('click', function () {
			const item = $(this).parents('li');
			item.prev().before(item);
		});

		list.find('.move-down').on('click', function () {
			const item = $(this).parents('li');
			item.next().after(item);
		});
	}

	function setupSavePluginOrder(selector, pluginListSelector, modalSelector) {
		$(selector).on('click', function () {
			const data = collectPluginOrder(pluginListSelector);
			savePluginOrder(data, modalSelector);
		});
	}

	function collectPluginOrder(pluginListSelector) {
		const plugins = $(pluginListSelector).children();
		const data = [];
		plugins.each(function (index, el) {
			data.push({ name: $(el).attr('data-plugin'), order: index });
		});
		return data;
	}

	function savePluginOrder(data, modalSelector) {
		socket.emit('admin.plugins.orderActivePlugins', data, function (err) {
			if (err) {
				return alerts.error(err);
			}
			handleSuccessfulOrderSave(modalSelector);
		});
	}

	function handleSuccessfulOrderSave(modalSelector) {
		$(modalSelector).modal('hide');

		alerts.alert({
			alert_id: 'plugin_reordered',
			title: '[[admin/extend/plugins:alert.reorder]]',
			message: '[[admin/extend/plugins:alert.reorder-success]]',
			type: 'success',
			timeout: 5000,
			clickfn: rebuildAndRestart,
		});
	}

	function rebuildAndRestart() {
		require(['admin/modules/instance'], function (instance) {
			instance.rebuildAndRestart();
		});
	}

	function confirmInstall(pluginID, callback) {
		bootbox.confirm(translator.compile('admin/extend/plugins:alert.possibly-incompatible', pluginID), function (confirm) {
			callback(confirm);
		});
	}

	function upgrade(pluginID, btn, version) {
		btn.attr('disabled', true).find('i').attr('class', 'fa fa-refresh fa-spin');
		socket.emit('admin.plugins.upgrade', {
			id: pluginID,
			version: version,
		}, function (err, isActive) {
			if (err) {
				return alerts.error(err);
			}
			const parent = btn.parents('li');
			parent.find('.fa-exclamation-triangle').remove();
			parent.find('.currentVersion').text(version);
			btn.remove();
			if (isActive) {
				alerts.alert({
					alert_id: 'plugin_upgraded',
					title: '[[admin/extend/plugins:alert.upgraded]]',
					message: '[[admin/extend/plugins:alert.upgrade-success]]',
					type: 'warning',
					timeout: 5000,
					clickfn: function () {
						require(['admin/modules/instance'], function (instance) {
							instance.rebuildAndRestart();
						});
					},
				});
			}
		});
	}

	// end of helper function

	Plugins.init = function () {
		const pluginsList = $('.plugins');
		const numPlugins = pluginsList[0].querySelectorAll('li').length;

		if (!numPlugins) {
			handleNoPluginsFound(pluginsList);
			return;
		}

		if (window.location.hash) {
			$(`.nav-pills button[data-bs-target="${window.location.hash}"]`).trigger('click');
		}

		const searchInputEl = document.querySelector('#plugin-search');
		searchInputEl.value = '';

		pluginsList.on('click', 'button[data-action="toggleActive"]', function () {
			const pluginEl = $(this).parents('li');
			const pluginID = pluginEl.attr('data-plugin-id');
			// const btn = $('[id="' + pluginID + '"] [data-action="toggleActive"]');
			const btn = $(this);
			const pluginData = ajaxify.data.installed[pluginEl.attr('data-plugin-index')];
			handlePluginActivation(pluginData, pluginID, pluginEl, btn);
		});

		pluginsList.on('click', 'button[data-action="toggleInstall"]', function () {
			toggleInstallButtonAction(this);
		});

		pluginsList.on('click', 'button[data-action="upgrade"]', function () {
			toggleUpgradeButtonAction(this);
		});

		filterAndUpdatePlugins(searchInputEl);

		setupPluginUsageToggle('#plugin-submit-usage');

		setupPluginOrderModal(
			'#plugin-order',
			'#order-active-plugins-modal',
			'#order-active-plugins-modal .plugin-list'
		);

		setupSavePluginOrder(
			'#save-plugin-order',
			'#order-active-plugins-modal .plugin-list',
			'#order-active-plugins-modal'
		);

		populateUpgradeablePlugins();
		populateActivePlugins();
	};


	Plugins.toggleInstall = function (pluginID, version, callback) {
		const btn = $('li[data-plugin-id="' + pluginID + '"] button[data-action="toggleInstall"]');
		btn.find('i').attr('class', 'fa fa-refresh fa-spin');

		socket.emit('admin.plugins.toggleInstall', {
			id: pluginID,
			version: version,
		}, function (err, pluginData) {
			if (err) {
				btn.removeAttr('disabled');
				return alerts.error(err);
			}
			function removeAndUpdateBadge(section) {
				$(`${section} [data-plugin-id="${pluginID}"]`).remove();
				const count = $(`${section} [data-plugin-id]`).length;
				$(`[data-bs-target="${section}"] .badge`).text(count);
			}
			if (!pluginData.installed) {
				['#installed', '#active', '#deactive', '#upgrade'].forEach(removeAndUpdateBadge);
			} else {
				ajaxify.refresh();
			}

			alerts.alert({
				alert_id: 'plugin_toggled',
				title: '[[admin/extend/plugins:alert.' + (pluginData.installed ? 'installed' : 'uninstalled') + ']]',
				message: '[[admin/extend/plugins:alert.' + (pluginData.installed ? 'install-success' : 'uninstall-success') + ']]',
				type: 'info',
				timeout: 5000,
			});

			if (typeof callback === 'function') {
				callback.apply(this, arguments);
			}
		});
	};

	Plugins.suggest = function (pluginId, callback) {
		const nbbVersion = app.config.version.match(/^\d+\.\d+\.\d+/);
		$.ajax((app.config.registry || 'https://packages.nodebb.org') + '/api/v1/suggest', {
			type: 'GET',
			data: {
				package: pluginId,
				version: nbbVersion[0],
			},
			dataType: 'json',
		}).done(function (payload) {
			callback(undefined, payload);
		}).fail(callback);
	};

	function populateUpgradeablePlugins() {
		$('#installed ul li').each(function () {
			if ($(this).find('[data-action="upgrade"]').length) {
				$('#upgrade ul').append($(this).clone(true));
			}
		});
	}

	function populateActivePlugins() {
		$('#installed ul li').each(function () {
			if ($(this).hasClass('active')) {
				$('#active ul').append($(this).clone(true));
			} else {
				$('#deactive ul').append($(this).clone(true));
			}
		});
	}

	return Plugins;
});
