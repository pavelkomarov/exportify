from matplotlib import pyplot
import pandas
from collections import defaultdict
from scipy.stats import pareto, gamma
from datetime import date

# create way to automatically fix rows mysteriously of different length?

# read the data
data = pandas.read_csv('music_that_tickles_my_fancy.csv')
print("total songs:", data.shape[0])

# count songs per artist
artists = defaultdict(int)
for i,song in data.iterrows():
	for musician in song['Artist Name'].split(', '):
		artists[musician] += 1

# sort for histogram
artists = pandas.DataFrame(artists.items(), columns=['Artist', 'Num Songs']).sort_values('Num Songs', ascending=False)
print("number of unique artists:", artists.shape[0])

# Looks power law-ish.
"""
# Let's find the best parameters. Need x, y data 'sampled' from the distribution for parameter fit.
y = []
for i in range(artists.shape[0]):
	for j in range(artists['Num Songs'][i]): # just let y have histogram_index[artist] repeated for each song 
		y.append(i)
# The documentation is pretty bad, but this is okay: https://stackoverflow.com/questions/6620471/fitting-empirical-distribution-to-theoretical-ones-with-scipy-python
param = pareto.fit(y, 100)
pareto_fitted = len(y)*pareto.pdf(range(artists.shape[0]), *param[:-2], loc=param[-2], scale=param[-1])
param = gamma.fit(y, 100)
gamma_fitted = len(y)*gamma.pdf(range(artists.shape[0]), *param[:-2], loc=param[-2], scale=param[-1])
"""

pyplot.figure(1, figsize=(18, 6))
pyplot.bar(artists['Artist'], artists['Num Songs'])
#pyplot.plot(pareto_fitted, color='r')
#pyplot.plot(gamma_fitted, color='g')
pyplot.xticks(visible=False)
pyplot.xlabel(artists.columns[0])
pyplot.ylabel(artists.columns[1])
pyplot.title('everybody')

# My top 20 artists by song count
pyplot.figure(2, figsize=(18, 10))
pyplot.bar(artists['Artist'][:50], artists['Num Songs'][:50])
pyplot.xticks(rotation=80)
pyplot.xlabel(artists.columns[0])
pyplot.ylabel(artists.columns[1])
pyplot.title('top 50')

# Plot of added volume over time
parse_date = lambda d:(int(d[:4]), int(d[5:7]), int(d[8:10]))
pyplot.figure(3, figsize=(10, 6))
pyplot.hist([date(*parse_date(d)) for d in data['Added At']], bins=30)
pyplot.title('volume added over time')

# histogram of the first histogram == hipster diversity factor
popularity = defaultdict(int)
for n in artists['Num Songs']:
	popularity[n] += n
popularity = pandas.DataFrame(popularity.items(), columns=['Unique Count', 'Volume']).sort_values('Volume', ascending=False)
print("number song-artist pairs represented in the hipster histogram:", sum(popularity['Volume']))

pyplot.figure(4, figsize=(10, 6))
pyplot.bar(popularity['Unique Count'].values, popularity['Volume'].values)
pyplot.title('volume of songs binned by |songs from that artist|')
pyplot.xlabel('quasi-frequency domain')
pyplot.ylabel(popularity.columns[1])

pyplot.show()
