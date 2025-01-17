/**
 * External dependencies
 */
const fs = require('fs');
const crypto = require('crypto');

/**
 * Internal dependencies
 */
const {
	API_URL,
	API_KEY,
	GOOGLE_FONTS_FILE_PATH,
	FONT_COLLECTION_SCHEMA_URL,
	FONT_COLLECTION_SCHEMA_VERSION,
} = require('./constants');


function formatCategoryName(slug) {
	return slug
		// Split the string into an array of words
		.split('-')
		// Capitalize the first letter of each word
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		// Join the words back into a single string, separated by spaces
		.join(' ');
}

function getCategories(fonts) {
	const category_slugs = new Set();
	fonts.forEach((font) => {
		category_slugs.add( font.category );
	});
	// Returs an array of categories
	const categories = [...category_slugs].map((slug) => (
		{
			name: formatCategoryName( slug ),
			slug,
		}
	));
	return categories;
}

function calculateHash(somestring) {
	return crypto
		.createHash('md5')
		.update(somestring)
		.digest('hex')
		.toString();
}

// Google Fonts API categories mappping to fallback system fonts
const GOOGLE_FONT_FALLBACKS = {
	display: 'system-ui',
	'sans-serif': 'sans-serif',
	serif: 'serif',
	handwriting: 'cursive',
	monospace: 'monospace',
};

function getStyleFromGoogleVariant(variant) {
	return variant.includes('italic') ? 'italic' : 'normal';
}

function getWeightFromGoogleVariant(variant) {
	return variant === 'regular' || variant === 'italic'
		? '400'
		: variant.replace('italic', '');
}

function getFallbackForGoogleFont(googleFontCategory) {
	return GOOGLE_FONT_FALLBACKS[googleFontCategory] || 'system-ui';
}

function httpToHttps(url) {
	return url.replace('http://', 'https://');
}

function getFontFamilyFromGoogleFont(font) {
	return {
		font_family_settings: {
			name: font.family,
			fontFamily: `${font.family}, ${getFallbackForGoogleFont(
				font.category
			)}`,
			slug: font.family.replace(/\s+/g, '-').toLowerCase(),
			fontFace: font.variants.map((variant) => ({
				src: httpToHttps(font.files?.[variant]),
				fontWeight: getWeightFromGoogleVariant(variant),
				fontStyle: getStyleFromGoogleVariant(variant),
				fontFamily: font.family,
			})),
		},
		categories: [ font.category ],
	};
}

async function updateFiles() {
	let newApiData;
	let newData;
	let response;
	
	try {
		newApiData = await fetch(`${API_URL}${API_KEY}`);
		response = await newApiData.json();
	} catch (error) {
		// TODO: show in UI and remove console statement
		// eslint-disable-next-line
		console.error('❎  Error fetching the Google Fonts API:', error);
		process.exit(1);
	}

	const fontFamilies = response.items.map(getFontFamilyFromGoogleFont);
	const categories = getCategories(response.items);

	// The data to be written to the file
	newData = {
		"$schema": FONT_COLLECTION_SCHEMA_URL,
		"version": FONT_COLLECTION_SCHEMA_VERSION,
		categories,
		font_families:fontFamilies, 
	};

	if (response.items) {
		const newDataString = JSON.stringify(newData, null, 2);
		
		// If the file doesn't exist, create it
		if ( ! fs.existsSync( GOOGLE_FONTS_FILE_PATH ) ) {
			fs.writeFileSync(GOOGLE_FONTS_FILE_PATH, '{}');
		}

		const oldFileData = fs.readFileSync(GOOGLE_FONTS_FILE_PATH, 'utf8');
		const oldData = JSON.parse(oldFileData);
		const oldDataString = JSON.stringify(oldData, null, 2);

		if (
			calculateHash(newDataString) !== calculateHash(oldDataString)
		) {
			fs.writeFileSync(GOOGLE_FONTS_FILE_PATH, newDataString);
			// TODO: show in UI and remove console statement
			// eslint-disable-next-line
			console.info('✅  Google Fonts JSON file updated');
		} else {
			// TODO: show in UI and remove console statement
			// eslint-disable-next-line
			console.info('ℹ️  Google Fonts JSON file is up to date');
		}
	} else {
		// TODO: show in UI and remove console statement
		// eslint-disable-next-line
		console.error(
			'❎  No new data to check. Check the Google Fonts API key.'
		);
		process.exit(1);
	}
}

updateFiles();
