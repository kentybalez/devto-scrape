const inquirer = require('inquirer');
const ora = require('ora');
const puppeteer = require('puppeteer');


function askQuestions() {
    const questions = [
        {
            name: 'tag',
            type: 'input',
            message: 'Tag to scrape ( Defaults to none ):'
        }
    ];

    return inquirer.prompt(questions);
}

async function main() {
    const answers = await askQuestions();

    const throbber = ora('Scraping Dev.to for your articles...').start();

    const rootURL = 'https://dev.to';
    let baseURL = rootURL;

    if (answers && answers.tag !== '') {
        baseURL = `https://dev.to/t/${answers.tag}`;
    }

    try {
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(baseURL);

        const featuredArticle = async () => {
            const singleArticleSeletor = await page.$('.big-article');
            if (singleArticleSeletor) {
                const title = await singleArticleSeletor.$eval('.content-wrapper > h3', e => e.textContent.trim()) || '';

                const userInformation = await singleArticleSeletor.$eval('.featured-user-name > a', e => e.textContent.split('・')) || [];
                const author = (userInformation[0] || '').trim();
                
                let publicationDate = '';
                let publicationTime = '';
                const publicationInfo = (userInformation[1] || '').split('\n');
                if (publicationInfo) {
                    publicationDate = (publicationInfo[0] || '').trim();
                    publicationTime = (publicationInfo[1] || '').trim().replace(/\(|\)/g, '');
                }
                
                const tags = await singleArticleSeletor.$$eval('.featured-tags > a', e => e.map(x => x.textContent)) || [];    
                let url = await singleArticleSeletor.$eval('a.index-article-link', e => e.getAttribute('href')) || '';
                url = rootURL + url;
                
                return {
                    title,
                    author,
                    publicationDate,
                    publicationTime,
                    tags,
                    url,
                }
            } else {
                return null;
            }

        };

        const subArticles = async () => {
            let substories = await page.$$('#substories > div.single-article.single-article-small-pic');
            
            const subArticles = [];
            for (const substory of substories) {
                let title = await substory.$eval('h3', e => e.textContent) || '';
                const tags = await substory.$$eval('.tags > a', e => e.map(x => x.textContent)) || [];

                let author = '';
                let publishDate = '';
                const userInformationSelector = await substory.$('h4');
                if (userInformationSelector) {
                    const userInformation = await substory.$eval('h4', e => e.textContent.split('・'));
                    author = (userInformation[0] || '').trim();
                    publishDate = (userInformation[1] || '').trim();
                }

                let url = '';
                const urlSelector = await substory.$('.index-article-link');
                if (urlSelector) {
                    url = await substory.$eval('.index-article-link', e => e.getAttribute('href'));
                    url = baseURL + url;
                }

                let numberOfReactions = 0;
                const reactions = await substory.$('.reactions-count');
                if (reactions) {
                    numberOfReactions = await reactions.$eval('span.engagement-count-number', e => e.innerHTML.trim());
                    numberOfReactions = Number(numberOfReactions);
                }

                let numberOfComments = 0;
                const comments = await substory.$('.comments-count');
                if (comments) {
                    numberOfComments = await comments.$eval('span.engagement-count-number', e => e.innerHTML.trim());
                    numberOfComments = Number(numberOfComments);
                }

                let readingTime = '';
                const time = await substory.$('.article-reading-time');
                if (time) {
                    readingTime = await substory.$eval('a.article-reading-time', e => e.textContent.trim());
                }

                if (tags && tags.length) {
                    subArticles.push({ 
                        title: title.trim(),
                        author,
                        publishDate, 
                        url,
                        tags, 
                        numberOfReactions, 
                        numberOfComments,
                        readingTime
                    });
                }
            }
            return subArticles;
        };
        
        const [featuredArticleResult, subArticleResult ] = await Promise.all([featuredArticle(), subArticles()]);
        await browser.close();
        
        throbber.stopAndPersist({
            text: 'All done scraping your articles!'
        });
        console.log('#### FEATURED ARTICLE ####');
        console.table(featuredArticleResult);
        
        console.log('#### OTHER ARTICLES ####');
        console.log(subArticleResult);

    } catch (error) {
        throbber.stopAndPersist({ text: 'Oopps, something bad happened :( '});
        console.error(error);
    }
}

main();