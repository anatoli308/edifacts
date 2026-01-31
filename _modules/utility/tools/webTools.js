/**
 * Utility Web Tools
 * =================
 * General-purpose tools (Weather, Web Search) used across domains.
 * Deterministic, sandboxed, with explicit JSON schemas.
 */

/**
 * getWeather: Current weather information for a city from an external API
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
 * webSearch: Simple web search results for a query with playwright (TODO: in a worker with python maybe)
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

		// Track search count to prevent infinite loops (stored in context)
		if (!context._searchCount) {
			context._searchCount = {};
		}
		const searchKey = String(query).toLowerCase().substring(0, 30);
		context._searchCount[searchKey] = (context._searchCount[searchKey] || 0) + 1;
		
		// Hard limit: max 2 searches for similar queries
		if (context._searchCount[searchKey] > 2) {
			return {
				success: false,
				error: `You have already searched for "${query}" ${context._searchCount[searchKey]} times. Please use the existing results instead of searching again.`,
				previousSearchCount: context._searchCount[searchKey],
				hint: 'Analyze the previous search results and provide your answer.'
			};
		}

		try {
			// Enhanced mock search results with more detailed content
			const mockResults = {
				EDIFACT: [
					{
						title: 'UN/EDIFACT - Electronic Data Interchange für Administration, Commerce and Transport',
						url: 'https://de.wikipedia.org/wiki/EDIFACT',
						snippet:
							'UN/EDIFACT ist ein internationaler Standard der Vereinten Nationen für den elektronischen Datenaustausch (EDI). Entwickelt in den 1980er Jahren, wird EDIFACT weltweit für B2B-Transaktionen verwendet, besonders in Logistik, Handel und Verwaltung. Der Standard definiert Nachrichtentypen wie ORDERS (Bestellung), INVOIC (Rechnung) und DESADV (Lieferavis).'
					},
					{
						title: 'EDIFACT Nachrichtenstruktur und Segmente',
						url: 'https://www.edifact.de/standard',
						snippet:
							'EDIFACT-Nachrichten bestehen aus Segmenten, die jeweils mit einem 3-stelligen Tag beginnen (z.B. UNH für Header, DTM für Datum/Zeit, NAD für Adressen). Jedes Segment enthält Datenelemente, getrennt durch + und :. Die Syntax ist hierarchisch und ermöglicht standardisierte Geschäftsdokumente zwischen verschiedenen Systemen.'
					},
					{
						title: 'EDIFACT vs. XML/JSON - Moderne Alternativen',
						url: 'https://www.unece.org/trade/untdid',
						snippet:
							'Während EDIFACT als Legacy-Standard gilt, wird er noch immer in vielen Branchen eingesetzt. Moderne Alternativen wie XML (ebXML) oder JSON-basierte APIs bieten bessere Lesbarkeit, sind aber nicht immer kompatibel mit bestehenden EDIFACT-Systemen. Die UN/CEFACT pflegt EDIFACT-Verzeichnisse und publiziert Updates.'
					}
				],
				default: [
					{
						title: `Suchergebnisse für "${query}"`,
						url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
						snippet: `Dies ist ein Mock-Ergebnis für "${query}". In der Produktion würde hier eine echte Web-Suche (Google/Bing API) durchgeführt. Die Ergebnisse würden relevante Websites, Artikel und Dokumente zum Thema enthalten.`
					}
				]
			};

			const matchedKey = Object.keys(mockResults).find((key) =>
				String(query).toLowerCase().includes(key.toLowerCase())
			);
			const results = mockResults[matchedKey || 'default'];
			
			// Add more context to help LLM understand the results
			const resultSummary = results.map((r, i) => `${i+1}. ${r.title}: ${r.snippet.substring(0, 100)}...`).join('\n');

			return {
				success: true,
				query,
				language,
				resultCount: results.length,
				results: results.slice(0, maxResults),
				summary: `Found ${results.length} results for "${query}". Key findings:\n${resultSummary}`,
				timestamp: new Date().toISOString(),
				note: 'Mock search results for testing. You have enough information to answer - do NOT search again!'
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

