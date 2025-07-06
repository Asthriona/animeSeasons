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

    // Function to fetch user anime list from Anilist
    async function fetchUserAnimeList(username) {
        showLoading(true);
        clearError();
        seasonsContainer.innerHTML = '';

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
                    query: query,
                    variables: { username }
                })
            });

            const filteredLists = (await response.json()).data.MediaListCollection.lists.filter(list => list.name !== 'Best of all time');
            const data = { data: { MediaListCollection: { lists: filteredLists } } };
            console.log(data);

            if (data.errors) {
                showError(data.errors[0].message);
                showLoading(false);
                return;
            }

            if (!data.data.MediaListCollection) {
                showError('No data found for this username');
                showLoading(false);
                return;
            }

            userData = data.data.MediaListCollection.lists.flatMap(list => list.entries);
            displayAnimeBySeasons(userData, currentStatus);

        } catch (error) {
            showError('Error fetching data: ' + error.message);
        } finally {
            showLoading(false);
        }
    }

    // Function to display anime by seasons
    function displayAnimeBySeasons(animeList, statusFilter) {
        seasonsContainer.innerHTML = '';

        // Filter by status if not "ALL"
        const filteredList = statusFilter === 'ALL'
            ? animeList
            : animeList.filter(entry => entry.status === statusFilter);

        if (filteredList.length === 0) {
            seasonsContainer.innerHTML = '<div class="no-results">No anime found with the selected status</div>';
            return;
        }

        // Group anime by season and year
        const animeBySeasons = {};

        filteredList.forEach(entry => {
            const anime = entry.media;
            if (!anime.season || !anime.seasonYear) return;

            const seasonKey = `${anime.seasonYear}-${anime.season}`;
            if (!animeBySeasons[seasonKey]) {
                animeBySeasons[seasonKey] = {
                    year: anime.seasonYear,
                    season: anime.season,
                    anime: []
                };
            }

            // Store both the anime media and user status
            animeBySeasons[seasonKey].anime.push({
                media: anime,
                status: entry.status
            });
        });

        // Sort seasons by year and season
        const sortedSeasons = Object.values(animeBySeasons).sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            const seasonOrder = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 };
            return seasonOrder[b.season] - seasonOrder[a.season];
        });

        // Determine current season
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        let currentSeason;
        if (currentMonth >= 0 && currentMonth <= 2) currentSeason = 'WINTER';
        else if (currentMonth >= 3 && currentMonth <= 5) currentSeason = 'SPRING';
        else if (currentMonth >= 6 && currentMonth <= 8) currentSeason = 'SUMMER';
        else currentSeason = 'FALL';

        const currentSeasonKey = `${currentYear}-${currentSeason}`;

        // Generate HTML for each season
        sortedSeasons.forEach(seasonData => {
            const seasonDiv = document.createElement('div');
            seasonDiv.className = 'season';

            const seasonHeader = document.createElement('div');
            seasonHeader.className = 'season-header';

            // Create left section for season name and "(current)" text
            const leftSection = document.createElement('div');
            leftSection.className = 'left-section';
            leftSection.textContent = `${seasonData.season} ${seasonData.year}`;

            // Check if this is the current season
            const isCurrentSeason = `${seasonData.year}-${seasonData.season}` === currentSeasonKey;
            if (isCurrentSeason) {
                const currentTag = document.createElement('span');
                currentTag.className = 'current-season-tag';
                currentTag.textContent = '(current)';
                leftSection.appendChild(currentTag);
            }

            // Add a download button for the season
            // const downloadButton = document.createElement('button');
            // downloadButton.className = 'download-season-btn';
            // downloadButton.textContent = 'Download Season Image';
            // downloadButton.style.display = 'block'; // Ensure visibility
            // downloadButton.addEventListener('click', () => {
            //     captureSeasonImage(seasonDiv, `${seasonData.season}-${seasonData.year}.png`);
            // });

            seasonHeader.appendChild(leftSection);
            // seasonHeader.appendChild(downloadButton);

            const animeGrid = document.createElement('div');
            animeGrid.className = 'anime-grid';

            // Sort anime within season by name
            seasonData.anime.sort((a, b) => {
                const titleA = a.media.title.english || a.media.title.romaji;
                const titleB = b.media.title.english || b.media.title.romaji;
                return titleA.localeCompare(titleB);
            });

            seasonData.anime.forEach(animeEntry => {
                const anime = animeEntry.media;
                const userStatus = animeEntry.status;
                const isFinished = anime.status === 'FINISHED';

                // Calculate total runtime
                const episodes = anime.episodes || 0;
                const duration = anime.duration || 0;
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
                animeLink.href = `https://anilist.co/anime/${anime.id}`;
                animeLink.target = '_blank';
                animeLink.appendChild(animeCard);

                const coverImage = document.createElement('img');
                coverImage.className = 'anime-cover';
                coverImage.src = anime.coverImage.large;
                coverImage.alt = anime.title.native || anime.title.romaji;

                const overlay = document.createElement('div');
                overlay.className = 'anime-overlay';
                overlay.title = `${anime.title.romaji || anime.title.native} - ${statusDisplay}`;

                const title = document.createElement('div');
                title.className = 'anime-title';
                title.textContent = anime.title.native || anime.title.romaji;

                const info = document.createElement('div');
                info.className = 'anime-info';

                const runtime = document.createElement('div');
                runtime.className = 'anime-runtime';
                runtime.textContent = runtimeFormatted;

                info.appendChild(runtime);

                overlay.appendChild(title);
                overlay.appendChild(info);

                if (isFinished) {
                    const finishedTag = document.createElement('div');
                    finishedTag.className = 'finished-tag';
                    finishedTag.textContent = 'Finished Airing';
                    animeCard.appendChild(finishedTag);
                }

                animeCard.appendChild(coverImage);
                animeCard.appendChild(overlay);
                animeLink.appendChild(animeCard);
                animeGrid.appendChild(animeLink);
            });

            seasonDiv.appendChild(seasonHeader);
            seasonDiv.appendChild(animeGrid);
            seasonsContainer.appendChild(seasonDiv);
        });
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
});

// Not sure why this caused an issue in production.
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

const navLinksContainer = document.getElementById('nav-links');
navigation.forEach(item => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = item.href;
    a.textContent = item.name;
    li.appendChild(a);
    navLinksContainer.appendChild(li);
});

// const socialLinksContainer = document.getElementById('social-links');
// socialLinks.forEach(link => {
//     const a = document.createElement('a');
//     if (!seasonsContainer) return alert("No season container.");
//     a.textContent = link.name;
//     a.target = '_blank';
//     socialLinksContainer.appendChild(a);
// });
