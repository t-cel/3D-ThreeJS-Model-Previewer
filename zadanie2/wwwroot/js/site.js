import * as THREE from './three.module.js';
import { OrbitControls } from './OrbitControls.js';

import { GLTFLoader } from './GLTFLoader.js';
import { MTLLoader } from './MTLLoader.js';
import { OBJLoader } from './OBJLoader.js';

const modelsList = $('#models_list');
const loadingScreen = $('#loading_screen');
const navLinks = $('.nav-link');

const clearColor = 0xEDEADE;

let previewCamera, previewScene, previewRenderer;
let thumbnailCamera, screenshotScene, screenshotRenderer;
let canvas = document.getElementById("c");
let currentModel;
let modelsData = [];
let currentFormat = 'GLTF';
let thumbnailModelIndex = 0;

// bind format to loading procedure
const loaders = {
	'GLTF': loadGLTFModel,
	'OBJ': loadOBJModel
}

/*
	The client sends an ajax request to the server and gets in response a dictionary where the key is the name of the format and the value is the list of models.

	After receiving the metadata, the scenes are initialized, one for previewing the selected model, and one for creating thumbnails on the fly.

	After the scenes are initialized, and every time the format is changed (by choosing a tab), a list of models is created
	for current format, thumbnails are created by rendering the scene for thumbnails to the photo.
*/

// on tab click
$('.nav-link').click(function () {
	navLinks.each(function () {
		$(this).removeClass('active');
	})

	currentFormat = $(this).text();
	$(this).addClass('active');
	thumbnailModelIndex = 0;
	makeList();
})

// load models metadata from server
$.ajax({
	url: '/?handler=ModelsData',
}).done(function (result) {
	modelsData = result;

	initThumbnailScene();
	initPreviewScene();
	makeList();
});

function dispose3DObject(object) {
	if (!object)
		return;

	object.traverse((node) => {
		if (!node.isMesh) return;

		node.geometry.dispose();
		node.material.dispose();
	});
}

//dispose old model and replace it with new
function replaceModels(content, scene) {

	if (currentModel && currentModel.parent == scene) {

		dispose3DObject(currentModel);
		scene.remove(currentModel);
    }
	currentModel = null;

	scene.add(content);
	currentModel = content;
}

// creates basic list according to current format
function makeList() {
	if (currentModel) {
		dispose3DObject(currentModel);
		previewScene.remove(currentModel);
    }

	modelsList.empty();

	for (var item in modelsData[currentFormat]) {
		let currItem = modelsData[currentFormat][item];

		let li = $(document.createElement('li'));
		li.addClass('list-group-item');
		li.addClass('p-3');
		li.addClass('m-1');
		modelsList.append(li);

		let a = $(document.createElement('a'));
		a.click(function () {
			loadingScreen.css('display', 'block');
			loadModel($(this).attr('name'), function (content) {
				replaceModels(content, previewScene);
				loadingScreen.css('display', 'none');
			});
			return false;
		});

		a.attr('name', currItem);
		a.attr('href', '#');
		li.append(a);

		let h5 = $(document.createElement('h5'));
		h5.text(currItem);
		a.append(h5);

		let spinner = $(document.createElement('div'));
		spinner.addClass('spinner-border');
		spinner.attr('role', 'status');
		a.append(spinner);
	}

	loadingScreen.css('display', 'block');
	//load first model to start making thumbnails
	loadModel(modelsData[currentFormat][thumbnailModelIndex], function (content) {
		replaceModels(content, screenshotScene);
		makeThumbnail();
	});
}

// common scene
function makeScene(onLoadEnd) {

	let scene = new THREE.Scene();

	//lights
	{
		var hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
		hemiLight.position.set(0, 300, 0);
		scene.add(hemiLight);

		var dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
		dirLight.position.set(75, 300, -75);
		scene.add(dirLight);
	}

	//plane
	{
		const planeSize = 30;
		const loader = new THREE.TextureLoader();
		const texture = loader.load('../imgs/checkerboard.png',
			// wait for texture load
			function () {
				if (onLoadEnd)
					onLoadEnd();
			}
		);

		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.magFilter = THREE.NearestFilter;
		const repeats = planeSize / 2;
		texture.repeat.set(repeats, repeats);

		const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
		const planeMat = new THREE.MeshPhongMaterial({
			map: texture,
			side: THREE.DoubleSide,
		});
		const mesh = new THREE.Mesh(planeGeo, planeMat);
		mesh.rotation.x = Math.PI * -.5;
		scene.add(mesh);
	}

	return scene;
}

function initThumbnailScene() {

	screenshotRenderer = new THREE.WebGLRenderer({
		antialias: true,
		preserveDrawingBuffer: true, 
	});

	screenshotRenderer.setSize(window.innerWidth, window.innerHeight);
	screenshotRenderer.setClearColor(clearColor, 1);
	screenshotRenderer.gammaOutput = true;
	screenshotRenderer.gammaFactor = 1.0;

	thumbnailCamera = new THREE.PerspectiveCamera(70, 192 / 128.0, 1, 1000);
	thumbnailCamera.position.z = 5;
	thumbnailCamera.position.y = 3;
	thumbnailCamera.position.x = 4;
	thumbnailCamera.lookAt(0, 1, 0);

	screenshotScene = makeScene();
}

function initPreviewScene() {

	previewRenderer = new THREE.WebGLRenderer({
		antialias: true,
		canvas
	});
	previewRenderer.setClearColor(clearColor, 1);
	previewRenderer.gammaOutput = true;
	previewRenderer.gammaFactor = 1.0;

	previewCamera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
	previewCamera.position.z = 8.0;
	previewCamera.position.y = 4.0;
	previewCamera.position.x = 5.5;
	previewCamera.lookAt(0, 0, 0);

	const controls = new OrbitControls(previewCamera, previewRenderer.domElement);
	controls.target.set(0, 1, 0);
	controls.update();

	previewRenderer.setSize(canvas.clientWidth, canvas.clientHeight);
	previewRenderer.setAnimationLoop(previewSceneUpdate);

	previewScene = makeScene(function () {
		$('#tip').text('Drag with LMB to orbit, Drag with RMB to move and zoom with MMB.');
	});

}

// fix camera and renderer on window resize 
window.onresize = function () {

	previewCamera.aspect = window.innerWidth / window.innerHeight;
	previewCamera.updateProjectionMatrix();

	previewRenderer.setSize(window.innerWidth, window.innerHeight);

	canvas.width = window.innerWidth;
	canvas.style.width = window.innerWidth;
	canvas.height = window.innerHeight;
	canvas.style.height = window.innerHeight;
}

function loadModel(model, onLoadEnd) {
	loaders[currentFormat](model, onLoadEnd);
}

function initializeModel(model, onLoadEnd) {
	model.traverse((node) => {
		if (!node.isMesh) return;

		node.material.side = THREE.DoubleSide;
		node.material.alphaTest = 0.25;
		node.material.needsUpdate = true;
	});

	//make sure model will appear on thumbnail
	setTimeout(function () {
		if (onLoadEnd)
			onLoadEnd(model);
	}, 100);
}

function loadGLTFModel(model, onLoadEnd) {
	var loader = new GLTFLoader();
	loader.load('../models/GLTF/' + model + '/' + model + '.glb', function (gltf) {
		initializeModel(gltf.scene, onLoadEnd);
	}, undefined, function (e) {
		console.error(e);
	});
}

function loadOBJModel(model, onLoadEnd) {

	var loader = new MTLLoader();
	loader.load('../models/OBJ/' + model + '/' + model + '.mtl', function (materials) {
		materials.preload();

		new OBJLoader()
			.setMaterials(materials)
			.load('../models/OBJ/' + model + '/' + model + '.obj', function (content) {
				initializeModel(content, onLoadEnd);
			}, undefined, function (e) {
				console.error(e);
			});
	}, undefined, function (e) {
		console.error(e);
	});
}

function makeThumbnail() {

	var img = new Image();
	screenshotRenderer.render(screenshotScene, thumbnailCamera);
	img.src = screenshotRenderer.domElement.toDataURL();

	let thumbnail = $(document.createElement('img'));

	thumbnail.attr('src', img.src);
	thumbnail.attr('width', '192');
	thumbnail.attr('height', '128');

	let item = $('[name="' + modelsData[currentFormat][thumbnailModelIndex] + '"]');
	item.find(".spinner-border").remove();
	item.append(thumbnail);

	thumbnailModelIndex++;

	if (thumbnailModelIndex < modelsData[currentFormat].length) {
		loadModel(modelsData[currentFormat][thumbnailModelIndex], function (content) {
			replaceModels(content, screenshotScene);
			makeThumbnail();
		});
    }
	else {
		dispose3DObject(currentModel);
		screenshotScene.remove(currentModel);
		loadingScreen.css('display', 'none');
    }
}

function previewSceneUpdate(time) {
	previewRenderer.render(previewScene, previewCamera);
}