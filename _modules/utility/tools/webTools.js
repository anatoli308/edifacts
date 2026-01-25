/**
 * Utility Web Tools
 * =================
 * General-purpose tools (Weather, Web Search) used across domains.
 * Deterministic, sandboxed, with explicit JSON schemas.
 */

/**
 * getWeather: Current weather information for a city
 */
export const getWeather = {
	name: 'getWeather',
	description: 'Get current weather information for a city',
	category: 'utility',
	module: 'utility',
	version: '1.0',
	inputSchema: {
		type: 'object',
		properties: {
			city: {
				type: 'string',
				description: 'City name (e.g., "Tokyo", "Berlin")'
			},
			country: {
				type: 'string',
				description: 'Optional: Country code or name (e.g., "JP", "Japan")'
			},
			units: {
				type: 'string',
				enum: ['celsius', 'fahrenheit'],
				description: 'Temperature units (default: celsius)'
			}
		},
		required: ['city']
	},
	async execute(args, context) {
		const { city, country = '', units = 'celsius' } = args;

		try {
			// Mock weather data (replace with real API call when available)
			const weatherData = {
				Tokyo: { temp: 12, condition: 'Cloudy', humidity: 65, wind_speed: 8 },
				Berlin: { temp: 5, condition: 'Rainy', humidity: 78, wind_speed: 12 },
				'New York': { temp: 8, condition: 'Clear', humidity: 55, wind_speed: 6 },
				London: { temp: 4, condition: 'Overcast', humidity: 72, wind_speed: 10 },
				Paris: { temp: 6, condition: 'Rainy', humidity: 80, wind_speed: 9 }
			};

			const cityKey = Object.keys(weatherData).find(
				(c) => c.toLowerCase() === String(city).toLowerCase()
			);

			if (!cityKey) {
				return {
					success: false,
					error: `Weather data not available for ${city}. Available cities: ${Object.keys(weatherData).join(', ')}`
				};
			}

			const data = weatherData[cityKey];
			const tempUnit = units === 'fahrenheit' ? '°F' : '°C';

			return {
				success: true,
				city: cityKey,
				country: country || 'Unknown',
				temperature: `${data.temp}${tempUnit}`,
				condition: data.condition,
				humidity: `${data.humidity}%`,
				wind_speed: `${data.wind_speed} km/h`,
				timestamp: new Date().toISOString()
			};
		} catch (error) {
			return {
				success: false,
				error: `Failed to fetch weather: ${error.message}`
			};
		}
	}
};

/**
 * webSearch: Simple web search results for a query
 */
export const webSearch = {
	name: 'webSearch',
	description: 'Search the web for information about a topic',
	category: 'utility',
	module: 'utility',
	version: '1.0',
	inputSchema: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description: 'Search query (e.g., "EDIFACT standards", "Tokyo weather")'
			},
			maxResults: {
				type: 'number',
				description: 'Maximum number of results (default: 3)',
				default: 3
			},
			language: {
				type: 'string',
				description: 'Language code (e.g., "en", "de", "fr")',
				default: 'en'
			}
		},
		required: ['query']
	},
	async execute(args, context) {
		const { query, maxResults = 3, language = 'en' } = args;

		try {
			// Mock search results (replace with real API like Google/Bing in prod)
			const mockResults = {
				EDIFACT: [
					{
						title: 'UN/EDIFACT - Electronic Data Interchange',
						url: 'https://en.wikipedia.org/wiki/EDIFACT',
						snippet:
							'UN/EDIFACT is a set of internationally agreed ISO standards, directories, and guidelines for electronic data interchange...'
					},
					{
						title: 'EDIFACT Basics Guide',
						url: 'https://www.edifactstandard.com/guide',
						snippet:
							'EDIFACT is used to exchange business documents like invoices, orders, and shipping notifications between trading partners...'
					},
					{
						title: 'EDIFACT Message Standards',
						url: 'https://www.unece.org/trade/untdid',
						snippet:
							'UNTDID provides the definitions of EDIFACT messages and segments...'
					}
				],
				Tokyo: [
					{
						title: 'Tokyo Travel Guide',
						url: 'https://example.com/tokyo',
						snippet:
							'Tokyo is the capital of Japan, known for its vibrant culture, advanced technology, and traditional temples...'
					},
					{
						title: 'Tokyo Climate Information',
						url: 'https://example.com/tokyo-climate',
						snippet:
							'Tokyo has a humid subtropical climate with winters around 5°C and summers around 27°C...'
					},
					{
						title: 'Things to Do in Tokyo',
						url: 'https://example.com/tokyo-activities',
						snippet:
							'Visit Senso-ji Temple, Meiji Shrine, Shibuya Crossing, and enjoy traditional Japanese cuisine...'
					}
				],
				default: [
					{
						title: `Results for "${query}"`,
						url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
						snippet: `Search results for your query about "${query}". This is a mock result for demonstration purposes.`
					}
				]
			};

			const matchedKey = Object.keys(mockResults).find((key) =>
				String(query).toLowerCase().includes(key.toLowerCase())
			);
			const results = mockResults[matchedKey || 'default'];

			return {
				success: true,
				query,
				language,
				results: results.slice(0, maxResults),
				timestamp: new Date().toISOString(),
				note: 'Mock search results for testing (use real API in production)'
			};
		} catch (error) {
			return {
				success: false,
				error: `Search failed: ${error.message}`
			};
		}
	}
};

export default { getWeather, webSearch };

