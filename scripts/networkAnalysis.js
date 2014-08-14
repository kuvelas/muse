/*
* networkAnalysis.js
*   
* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/.
*
*
* Description:    Analyses network statistics contains in networkDatabase.js and 
* 				  determines the best times for fetching data from the Internet.
*
*
*/



// setup global network analysis object
var netStats = (function() {
	"use strict";
		
	// create empty object. Add properties and methods.
	var netstats = {};
	
	// add properties with default values.
	netstats.ready = false;   // Indicates whether NetStats is fully initialized.
	netstats.goodTimes = [];  // array of bools that indicate a good connection time. true or false
	netstats.deltaTime = 15;  // The number of minutes between network data points.
	netstats.errorCodes = {NET_STATS_DB_UNDEFINED:1, 
						   ERROR_OPENING_DATABASE:2, 
						   NO_GOOD_CONNECTION_TIME_TODAY:3};
	
	netstats.SUCCESS = 0;
	
	netstats.messages = ["Success",
	                     "Global object 'netStatsDB' is not undefined.",
	                     "Unknown error occured opening the network statistics data base.",
	                     "No good connection time was found for today."];
	
	netstats.wifiCollectionTimes = [];
	netstats.mobileCollectionTimes = [];
	
	// Default network statistics analysis tool. This can be replaced with any object that
	// has a 'runAnalysis' function and a 'date' property. Use duck typing. 
	// This can be set before or after calling init(). 
	// Example: netStats.analyzer = myAnalyserObject;
	netstats.analyser = {
		// Date that the analysis was run for. 
		date:null,
		
	  // Does analysis on bandwidth data to determine best times to connect to the Internet.
		// Analyses one day's data across the number of weeks stored in netStatsDB.
		// Param  date:Date object. If not passed in then the current date is used
		runAnalysis:function(date) {
			this.date = date || new Date();
			var records = netStatsDB.getRecordsDay(this.date.getDay());  // get records for today.
			var goodTimes = [];  // local variable version of netstats.goodTimes.
			var bool = null;  // temp variable used to simplify code.
			
			// Look at each record and determine if a network is present that has sufficient bandwidth.
			for (var i = 0; i < records.length ; ++i) {
				// only looking at first data point in queue because using fake data.
				bool = this.bandwidthGood(records[i][0].Wifi); 
				goodTimes.push(bool);
			}
			
			netStats.goodTimes = goodTimes;
			
			// Determine the number of minutes between data points.
			netStats.deltaTime = Math.floor(60 * 24 / records.length);
			
		},
		
		// Determines if there is sufficient bandwidth in the passed in list of network objects.
		// Param  networks:array of network objects. See networkDatabase.js getFakeNetworks() for example network object.
		bandwidthGood:function(WiFiNetwork) {
			var minGoodBandwidth = 50;
			if (WiFiNetwork.Bandwidth > minGoodBandwidth) {
				return true;
			}			
			return false;
		},

		/////NEW/////
		///Helper functions to filter out unusable collection times ///
		futureTime:function(element){
				return element.Time.getTime() >= (new Date()).getTime();
		},
		
		//TODO: replace these magic numbers with constants, confirm #'s for b/s and link speed
		goodWifiLinkSpeed:function(element){
			return element.avgWifiLinkSpeed >= 4;
		},
		goodWifiBytesPerSecond:function(element){
			return element.avgWifiBytesPerSecond >= 200 && element.avgWifiBytesPerSecond <= 30000;
		},
		goodWifiSignalStrength:function(element){
			return element.avgWifiSignalStrength >= 25;
		},
		goodMobileBytesPerSecond:function(element){
			return element.avgMobileBytesPerSecond >= 100 && element.avgMobileBytesPerSecond <= 10000;
		},
		goodMobileSignalStrength:function(element){
			return element.avgMobileSignalStrength >= 25;
		},
		
		//Remove mobileCollectionTimes that are also in wifiCollectionTimes
		notInWifiTimes:function(element){
			
			netStats.wifiCollectionTimes.forEach(wifiTime) {
				if(element.Time == wifiTime.Time){
					return false;
				}
			
			};
			
			return true;
		},		
		
		//Second shot at a runAnalysis function
		//Checks data sent/rec, signal strength, link speed on wifi connections.
		//updates netstats.wifiCollectionTimes and netstats.mobileConnection times with usable times
		runAnalysis2:function(date){
			this.date = date || new Date();
			var todayStats = netStatsDB.getRecordsDay(this.date.getDay());  // get records for today.
			//var todayStats = netStatsDB.getRecordsDay(1);  // testing!
			var collectionTimes = [];
      
			todayStats.forEach(function (interval){
       
				var weeks = interval.length;
				
				var avgStat = {};	
				avgStat.avgWifiBytesPerSecond = 0;
				avgStat.avgWifiLinkSpeed = 0;
				avgStat.avgWifiSignalStrength = 0;
				avgStat.avgMobileBytesPerSecond = 0;
				avgStat.avgMobileSignalStrength = 0;
				avgStat.Time = new Date();
				
				netstats.wifiCollectionTimes = [];
				netstats.mobileCollectionTimes = [];
			  
				if(interval[0]){
					avgStat.Time.setHours(interval[0].End.getHours());
					avgStat.Time.setMinutes(interval[0].End.getMinutes());
					avgStat.Time.setSeconds(0);
				}else{
					console.log("corrupted database!!!");
					//There was a key which held an empty list, this should never happen!
				}
			
				var totalSeconds = 0;	
			
				interval.forEach(function (stat){
					totalSeconds += (stat.End.getTime() - stat.Start.getTime()) / 1000;  //ms to seconds
					
					if(stat.Wifi.Connected){
					
						avgStat.avgWifiBytesPerSecond += stat.Wifi.DataReceived + stat.Wifi.DataSent;
						avgStat.avgWifiLinkSpeed += stat.Wifi.Bandwidth;
						avgStat.avgWifiSignalStrength += stat.Wifi.SignalStrength;
					}
					
					if(stat.Mobile.Connected && !stat.Mobile.Metered && !stat.Mobile.Roaming){
						avgStat.avgMobileBytesPerSecond += stat.Mobile.DataReceived + stat.Mobile.DataSent;
						avgStat.avgMobileSignalStrength += stat.Mobile.SignalStrength;
					}
					
				});
			
				avgStat.avgWifiBytesPerSecond =  avgStat.avgWifiBytesPerSecond / totalSeconds;
				avgStat.avgWifiLinkSpeed = avgStat.avgWifiLinkSpeed / weeks;
				avgStat.avgWifiSignalStrength = avgStat.avgWifiSignalStrength / weeks;
				
				avgStat.avgMobileBytesPerSecond = avgStat.avgMobileBytesPerSecond / totalSeconds;
				avgStat.avgMobileSignalStrength = avgStat.avgMobileSignalStrength / weeks;
				
				collectionTimes.push(avgStat);
			});		
			
			///Filter out unusable collection times ///
			netStats.wifiCollectionTimes = collectionTimes.filter(this.futureTime);
			netStats.wifiCollectionTimes = netStats.wifiCollectionTimes.filter(this.goodWifiLinkSpeed);
			netStats.wifiCollectionTimes = netStats.wifiCollectionTimes.filter(this.goodWifiBytesPerSecond);
			netStats.wifiCollectionTimes = netStats.wifiCollectionTimes.filter(this.goodWifiSignalStrength);
			
			netStats.mobileCollectionTimes = collectionTimes.filter(this.futureTime);
			netStats.mobileCollectionTimes = netStats.mobileCollectionTimes.filter(this.notInWifiTimes); 
			netStats.mobileCollectionTimes = netStats.mobileCollectionTimes.filter(this.goodMobileBytesPerSecond);
			netStats.mobileCollectionTimes = netStats.mobileCollectionTimes.filter(this.goodMobileSignalStrength);
		
		}
	};
	
	
	/*
	 * ***************************************************************************************
	 * 	    ASYCHRONOUS METHODS
	 * ***************************************************************************************
	 */
	
	
	// Initialization function
	// Returns: Error code or netStatsDB.SUCCESS
	// Param onReadyCallback:function  Called when netStats is ready.
	netstats.init = function(onReadyCallback) {
		this.onReadyCallback = onReadyCallback;
		
		if (netStatsDB === "undefined") {
			return netStats.errorCodes.NET_STATS_DB_UNDEFINED;
		}
		
		netStatsDB.open(function(status) {
			if (status == netStatsDB.SUCCESS) {				
				//netStats.analyser.runAnalysis();			
				netStats.analyser.runAnalysis2();			
				netStats.ready = true;
				
				if (typeof netStats.onReadyCallback === "function"){
					netStats.onReadyCallback(netStats.SUCCESS);
			    }
				
			} else if (status == netStatsDB.errorCodes.DATABASE_EMPTY) {
				// Populate the DB with fake data and then do analysis.
				//netStatsDB.generateFakeDays(new Date(), 28, 15);  // create four weeks of data at 15 minute increments.
				fakeMonth.generateFakeMonth();
				console.log("Finished generating Fake data.");
								
				netStatsDB.save(function(){});
				console.log("saved data base.");

				//netStats.analyser.runAnalysis();				
				netStats.analyser.runAnalysis2();			
				netStats.ready = true;
				
				if (typeof netStats.onReadyCallback === "function"){
					netStats.onReadyCallback(netStats.SUCCESS);
			    }
				
			} else {
				netStats.ready = false;
				
				console.log("netStats.init(): Error opening network data base.");
				if (typeof netStats.onReadyCallback === "function"){
					netStats.onReadyCallback(netStats.errorCodes.ERROR_OPENING_DATABASE);
			    }
			}
		});
			
		return netStats.SUCCESS;
	};
	
	
	/* 
	 * **************************************************************************************
	 * 	    SYCHRONOUS METHODS
	 * **************************************************************************************
	 */
	
	
	// Function for getting the next best time to try downloading data from the Internet.
	// Returns:Tuple  {date:Date, error:netStats.SUCCESS or error code}
	// Note: Looks at netStats.goodTimes array which defaults to the current day, but it can be a different
	// day if netStats.analyser.runAnalysis(date) is called with a different date before calling this method.
	netstats.nextBestDate = function() {
		var curDate = netStats.analyser.date;
		var curTotalMinutes = curDate.getHours() * 60 + curDate.getMinutes();
		var startIndex = Math.ceil(curTotalMinutes / netStats.deltaTime);
		var index = startIndex;
		
		for (; index < netStats.goodTimes.length; ++index) {
			if (netStats.goodTimes[index]) {
				break;
			}
		}
		
		if (index < netStats.goodTimes.length) {
			// Advance curDate to next good time.
			
			// Round current minutes up to next time interval.
			curTotalMinutes = (Math.floor(curTotalMinutes /  netStats.deltaTime) + 1) * netStats.deltaTime;
			// Add in the number of minutes needed to advance the time.
			var mins = curTotalMinutes + ((index - startIndex) * netStats.deltaTime);
			// convert total minutes to hours and minutes.
			var hours = Math.floor(mins / 60);
			mins = mins % 60;

			curDate.setHours(hours, mins, 0, 0);
			return {date:curDate, error:netStats.SUCCESS};
			
		} else {
			return {date:curDate, error:netStats.errorCodes.NO_GOOD_CONNECTION_TIME_TODAY};
		}
	};
	
	netstats.nextBestDate2 = function() {
    var oneHour = 3600000;
		var rightNow = new Date();
		var bestIndex = 0;
		var bestLinkSpeed = 0;		
		var bestSS = 0;	
		var todaysWifiTimes = netStats.wifiCollectionTimes.filter(netStats.analyser.futureTime);
		var todaysMobileTimes;
		
		//Helper function: nextHour
		//Argument: List of future times
		//Returns: List of collection times within next hour
		var nextHour = function (times){
		  var nextTime = [];
			
			if(times.length !=0){
				times.forEach(function (element) {
					if(element.Time.getTime() < (rightNow.getTime() + oneHour)){
						nextTime.push(element); 
					}else{
						return nextTime;
					}
				});
			}else{
			  return nextTime;
			}
			
		};
		
		//First try to find the best wifi collection time within the next hour
		var nextWifi = nextHour(todaysWifiTimes);
	
		if(nextWifi.length > 0){
		
			nextWifi.forEach(function (element, i){
				if(element.avgWifiLinkSpeed > bestLinkSpeed){
					bestIndex = i;
					bestLinkSpeed = element.avgWifiLinkSpeed;
				}
			});
			console.log("Wifi time within hour: " + nextWifi[bestIndex].Time);
			return {date:nextWifi[bestIndex], error:netStats.SUCCESS};
			
		}else{
			//No wifi times within hour, find best mobile time within hour
			todaysMobileTimes = netStats.mobileCollectionTimes.filter(netStats.analyser.futureTime);	
			var nextMobile = nextHour(todaysMobileTimes);
			
			if(nextMobile.length > 0){
				
				nextMobile.forEach(function (element, i){
					if(element.avgMobileSignalStrength > bestSS){
						bestIndex = i;
						bestSS = element.avgMobileSignalStrength;
					}
				});

				console.log("Mobile time within hour: " + nextMobile[bestIndex].Time);
				return {date:nextMobile[bestIndex], error:netStats.SUCCESS};
				
			}else {
				//No mobile or wifi times within hour, finding next usable wifi time
				if(todaysWifiTimes.length !== 0){
					console.log("No connection times within hour, next wifi time is: " + todaysWifiTimes[0].Time);
					return {date:todaysWifiTimes[0], error:netStats.SUCCESS};
				}else if(todaysMobileTimes.length !== 0){
					//No wifi times today, find next mobile time today
					console.log("No wifi times today, next mobile is: " + todaysMobileTimes[0].Time);
					return {date:todaysMobileTimes[0], error:netStats.SUCCESS};
				}else{
					//There are no more usable times today
					console.log("NO TIMES TODAY!");
					return {date:null, error:netStats.errorCodes.NO_GOOD_CONNECTION_TIME_TODAY};
					//TODO: find next usable time tomorrow unless database empty (inf loop if no usable times??)
					//Better: services sets alarm for tomorrow, calls runAnalysis, asks for nextBestTime again
				}		
			}
		}
	};
	
	
	
	netstats.currentlyFetchable = function() {
		var infoPack;
		if(navigator.mozWifiManager){
			infoPack = netCollect.currentWifiInfo();
		} else {
			infoPack = netCollect.fakeCurrentWifiInfo();
		}
		
        if (infoPack.WifiData === true) {
            if (infoPack.WifiLinkSpeed > 4 && infoPack.WifiSignalStrength > 24) {
              return true;
            }
        }
        
        return false;
	};
	
	
	
	// return network statistics object to global name space.
	return netstats;
	
}());




