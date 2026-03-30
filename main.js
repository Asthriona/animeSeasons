document.addEventListener('DOMContentLoaded', () => {
    const loadingElement = document.getElementById('loading');
    const seasonsContainer = document.getElementById('seasons-container');
    const errorContainer = document.getElementById('error-container');
    const statusButtons = document.querySelectorAll('.status-btn');

    // Remove dependency on the hardcoded button
    // const downloadButton = document.getElementById("download-season-image");
    // if (downloadButton) {
    //     downloadButton.remove();
    // }

    // Hard-coded username
    const username = "asthriona";

    let userData = null;
    let currentStatus = 'ALL'; // Default to ALL

    // Cache key for localStorage
    const CACHE_KEY = 'anilist_user_data';
    const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds

    // Determine current season once
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    let currentSeason;
    if (currentMonth >= 0 && currentMonth <= 2) currentSeason = 'WINTER';
    else if (currentMonth >= 3 && currentMonth <= 5) currentSeason = 'SPRING';
    else if (currentMonth >= 6 && currentMonth <= 8) currentSeason = 'SUMMER';
    else currentSeason = 'FALL';
    const currentSeasonKey = `${currentYear}-${currentSeason}`;

    // Add event listener to status filter buttons
    statusButtons.forEach(button => {
        button.addEventListener('click', () => {
            statusButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentStatus = button.dataset.status;

            if (userData) {
                displayAnimeBySeasons(userData, currentStatus);
            }
        });
    });

    // Fetch user anime list on page load
    fetchUserAnimeList(username);

/**
 * Fetches the user's anime list from AniList GraphQL API.
 * Uses caching to avoid repeated API calls.
 * @param {string} username - The AniList username.
 */
async function fetchUserAnimeList(username) {
        showLoading(true);
        clearError();
        seasonsContainer.innerHTML = '';

        // Check cache first
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_EXPIRY) {
                    userData = data;
                    displayAnimeBySeasons(userData, currentStatus);
                    showLoading(false);
                    return;
                }
            } catch {
                // Invalid cache, proceed to fetch
            }
        }

        const query = `
            query ($username: String) {
                MediaListCollection(userName: $username, type: ANIME) {
                    lists {
                        name
                        status
                        entries {
                            status
                            media {
                                id
                                title {
                                    romaji
                                    english
                                    native
                                }
                                coverImage {
                                    large
                                }
                                episodes
                                duration
                                seasonYear
                                season
                                status
                                genres
                                format
                                source
                                averageScore
                                description(asHtml: false)
                                studios(isMain: true) {
                                    nodes { name }
                                }
                            }
                        }
                    }
                }
            }
        `;

        try {
            const response = await fetch('https://graphql.anilist.co', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    variables: { username }
                })
            });

            const result = await response.json();
            const filteredLists = result?.data?.MediaListCollection?.lists?.filter(list => list.name !== 'Best of all time') || [];
            const data = { data: { MediaListCollection: { lists: filteredLists } } };

            if (data.errors) {
                showError(data.errors[0]?.message || 'Unknown error');
                showLoading(false);
                return;
            }

            if (!data.data?.MediaListCollection) {
                showError('No data found for this username');
                showLoading(false);
                return;
            }

            userData = data.data.MediaListCollection.lists.flatMap(list => list.entries);

            // Cache the data
            localStorage.setItem(CACHE_KEY, JSON.stringify({ data: userData, timestamp: Date.now() }));

            displayAnimeBySeasons(userData, currentStatus);

        } catch (error) {
            showError(`Error fetching data: ${error.message}`);
        } finally {
            showLoading(false);
        }
    }

/**
 * Displays the anime list grouped by seasons.
 * Filters by status, groups by season/year, sorts, and renders the DOM.
 * @param {Array} animeList - Array of anime entries.
 * @param {string} statusFilter - Status to filter by ('ALL' or specific status).
 */
function displayAnimeBySeasons(animeList, statusFilter) {
        seasonsContainer.innerHTML = '';

        // Filter by status if not "ALL"
        const filteredList = statusFilter === 'ALL'
            ? animeList
            : animeList.filter(({ status }) => status === statusFilter);

        if (filteredList.length === 0) {
            seasonsContainer.innerHTML = '<div class="no-results">No anime found with the selected status</div>';
            return;
        }

        // Group anime by season and year
        const animeBySeasons = {};

        filteredList.forEach(({ media, status }) => {
            const { season, seasonYear } = media;
            if (!season || !seasonYear) return;

            const seasonKey = `${seasonYear}-${season}`;
            if (!animeBySeasons[seasonKey]) {
                animeBySeasons[seasonKey] = {
                    year: seasonYear,
                    season,
                    anime: []
                };
            }

            // Store both the anime media and user status
            animeBySeasons[seasonKey].anime.push({ media, status });
        });

        // Sort seasons by year and season
        const sortedSeasons = Object.values(animeBySeasons).sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            const seasonOrder = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 };
            return seasonOrder[b.season] - seasonOrder[a.season];
        });

        // Use DocumentFragment for batch DOM insertion
        const fragment = document.createDocumentFragment();

        // Generate HTML for each season
        sortedSeasons.forEach(({ year, season, anime }) => {
            const seasonDiv = document.createElement('div');
            seasonDiv.className = 'season';

            const seasonHeader = document.createElement('div');
            seasonHeader.className = 'season-header';

            // Create left section for season name and "(current)" text
            const leftSection = document.createElement('div');
            leftSection.className = 'left-section';
            leftSection.textContent = `${season} ${year}`;

            // Check if this is the current season
            const isCurrentSeason = `${year}-${season}` === currentSeasonKey;
            if (isCurrentSeason) {
                const currentTag = document.createElement('span');
                currentTag.className = 'current-season-tag';
                currentTag.textContent = '(current)';
                leftSection.appendChild(currentTag);
            }

            seasonHeader.appendChild(leftSection);

            const animeGrid = document.createElement('div');
            animeGrid.className = 'anime-grid';

            // Sort anime within season by name
            anime.sort((a, b) => {
                const titleA = a.media.title.english || a.media.title.romaji;
                const titleB = b.media.title.english || b.media.title.romaji;
                return titleA.localeCompare(titleB);
            });

            anime.forEach(({ media: animeData, status: userStatus }) => {
                const { status, episodes = 0, duration = 0, title, coverImage, id } = animeData;
                const isFinished = status === 'FINISHED';

                // Calculate total runtime
                const totalMinutes = episodes * duration;
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;

                // Format runtime as "X hours Y minutes"
                let runtimeFormatted = '';
                if (hours > 0) {
                    runtimeFormatted += `${hours} hour${hours !== 1 ? 's' : ''}`;
                }
                if (minutes > 0) {
                    if (hours > 0) runtimeFormatted += ' ';
                    runtimeFormatted += `${minutes} minute${minutes !== 1 ? 's' : ''}`;
                }
                if (runtimeFormatted === '') {
                    runtimeFormatted = 'Runtime TBA';
                }

                // Get status display name
                const statusDisplay = {
                    'COMPLETED': 'Completed',
                    'CURRENT': 'Watching',
                    'DROPPED': 'Dropped',
                    'PAUSED': 'Paused',
                    'PLANNING': 'Planning'
                }[userStatus];

                // Create anime card                
                const animeCard = document.createElement('div');
                animeCard.className = `anime-card status-${userStatus}`;
                if (isFinished) animeCard.classList.add('finished');

                // Link to anilist page
                const animeLink = document.createElement('a');
                animeLink.href = `https://anilist.co/anime/${id}`;
                animeLink.target = '_blank';
                animeLink.appendChild(animeCard);

                const coverImageEl = document.createElement('img');
                coverImageEl.className = 'anime-cover';
                coverImageEl.src = coverImage.large;
                coverImageEl.alt = title.native || title.romaji;
                coverImageEl.loading = 'lazy'; // Lazy load images

                const overlay = document.createElement('div');
                overlay.className = 'anime-overlay';
                overlay.title = `${title.romaji || title.native} - ${statusDisplay}`;

                const titleEl = document.createElement('div');
                titleEl.className = 'anime-title';
                titleEl.textContent = title.native || title.romaji;

                const info = document.createElement('div');
                info.className = 'anime-info';

                const runtime = document.createElement('div');
                runtime.className = 'anime-runtime';
                runtime.textContent = runtimeFormatted;

                info.appendChild(runtime);

                overlay.appendChild(titleEl);
                overlay.appendChild(info);

                if (isFinished) {
                    const finishedTag = document.createElement('div');
                    finishedTag.className = 'finished-tag';
                    finishedTag.textContent = 'Finished Airing';
                    animeCard.appendChild(finishedTag);
                }

                animeCard.appendChild(coverImageEl);
                animeCard.appendChild(overlay);
                animeLink.appendChild(animeCard);
                animeGrid.appendChild(animeLink);
            });

            seasonDiv.appendChild(seasonHeader);
            seasonDiv.appendChild(animeGrid);
            fragment.appendChild(seasonDiv);
        });

        seasonsContainer.appendChild(fragment);
    }

    // Helper functions
    function showLoading(isLoading) {
        loadingElement.style.display = isLoading ? 'block' : 'none';
    }

    function showError(message) {
        errorContainer.innerHTML = `<div class="error-message">${message}</div>`;
    }

    function clearError() {
        errorContainer.innerHTML = '';
    }

    /**
     * Utility function to capture a season image using html2canvas.
     * @param {HTMLElement} targetElement - The DOM element to capture.
     * @param {string} fileName - The name of the downloaded file.
     */
    // function captureSeasonImage(targetElement, fileName) {
    //     html2canvas(targetElement, {
    //         backgroundColor: null, // transparent
    //         useCORS: true, // allows cross-origin images
    //         scale: 2 // higher resolution
    //     }).then(canvas => {
    //         const link = document.createElement("a");
    //         link.download = fileName;
    //         link.href = canvas.toDataURL("image/png");
    //         link.click();
    //     });
    // }

    // Populate footer year
    const yearElement = document.getElementById('year');
    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    const navigation = [
        { name: 'Home', href: '/' },
        { name: 'Blog', href: '/blog' },
        { name: 'Projects', href: '/projects' },
        { name: 'About', href: '/about' },
        { name: 'Anime', href: '/anime' },
    ];

    const socialLinks = [
        { name: 'GitHub', href: 'https://github.com/Asthriona' },
        { name: 'BlueSky', href: 'https://bsky.app/profile/asthriona.bsky.social' },
        { name: 'Twitter', href: 'https://twitter.com/Asthriona' },
        { name: 'YouTube', href: 'https://youtube.com/@Asthriona' },
        { name: 'Instagram', href: 'https://www.instagram.com/asthriona.dev/' },
    ];

    // Populate navigation links
    const navLinksContainer = document.getElementById('nav-links');
    navigation.forEach(item => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = item.href;
        a.textContent = item.name;
        li.appendChild(a);
        navLinksContainer.appendChild(li);
    });
});
