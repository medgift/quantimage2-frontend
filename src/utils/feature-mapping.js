export const CATEGORIES = {
  Intensity: 'Intensity',
  Texture: 'Texture',
  Shape: 'Shape',
  SUV: 'SUV',
};

export const FEATURE_DEFINITIONS = [
  {
    id: 'firstorder_10Percentile',
    url: 'www.radiomics.org/RO/GPMT',
    description: '10 Percentile of the histogram',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_90Percentile',
    url: 'www.radiomics.org/RO/OZ0C',
    description: '90 percentile of the histogram',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_Energy',
    url: 'www.radiomics.org/RO/8ZQL',
    description:
      'It represents the energy of the probability matrix. Please note that this feature is also called Energy or Uniformity.',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_Entropy',
    url: 'www.radiomics.org/RO/TLU2',
    description: 'It is the Shannon entropy of the histogram',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_InterquartileRange',
    url: 'www.radiomics.org/RO/WR0O',
    description:
      'Difference between the 75 and 25 interquartiles of the histogram',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_Kurtosis',
    url: 'www.radiomics.org/RO/C3I7',
    description:
      'Kurtosis is a measure of how outlier-prone a distribution is. The kurtosis of the normal distribution is 3. Distributions that are more outlier-prone than the normal distribution have kurtosis greater than 3; distributions that are less outlier-prone have kurtosis less than 3',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_Maximum',
    url: 'www.radiomics.org/RO/3NCY',
    description: 'Highest discretized grey level in the histogram distribution',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_Mean',
    url: 'www.radiomics.org/RO/X6K6',
    description: 'The mean gray level',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_MeanAbsoluteDeviation',
    url: 'www.radiomics.org/RO/D2ZX',
    description: 'Measure of dispersion from the mean of the histogram',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_Median',
    url: 'www.radiomics.org/RO/WIFQ',
    description: 'Median value of the histogram',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_Minimum',
    url: 'www.radiomics.org/RO/1PR8',
    description: 'Minimum gray level bin',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_Range',
    url: 'www.radiomics.org/RO/5Z3W',
    description: 'Difference between maximum and minimum of the histogram',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_RobustMeanAbsoluteDeviation',
    url: 'www.radiomics.org/RO/WRZB',
    description:
      'The intensity histogram robust mean absolute deviation is the mean restricted to grey values closer to the center of the distribution',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_RootMeanSquared',
    url: 'www.radiomics.org/RO/5ZWQ',
    description:
      'The square root of the arithmetic mean of the squares of the values',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_Skewness',
    url: 'www.radiomics.org/RO/88K1',
    description:
      'The skewness measures the degree of histogram of gray levels asymmetry around the central value',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_TotalEnergy',
    url: 'www.radiomics.org/RO/2490',
    description:
      'Total Energy is the value of Energy feature scaled by the volume of the voxel in cubic mm',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_Uniformity',
    url: 'www.radiomics.org/RO/BJ5W',
    description:
      'The uniformity is a measure of the randomness of the grey levels distribution histogram',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_Variance',
    url: 'www.radiomics.org/RO/CH89',
    description: 'Variance of the intensities',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_MTV',
    url: '',
    description:
      'Metabolic tumor volume (MTV) refers to the metabolically active volume of the tumor segmented using FDG PET',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_TLG',
    url: '',
    description:
      'Total lesion glycolysis (TLG) is the product of mean SUV and MTV',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'firstorder_SUVpeak',
    url: '',
    description:
      'SUVpeak is defined as the average SUV within a small, fixed-size region of interest (ROIpeak) centered on a high-uptake part of the tumor',
    category: 'Intensity',
    subcategory: '',
  },
  {
    id: 'glcm_Autocorrelation',
    url: 'www.radiomics.org/RO/QWB0',
    description:
      'The autocorrelation compares all possible pixel pairs and reporting the likelihood that both will be bright as a function of the distance and direction of separation',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_ClusterProminence',
    url: 'www.radiomics.org/RO/AE86',
    description:
      'The cluster prominence is a measure of asymmetry. When the cluster prominence value is high, the image is less symmetric',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_ClusterShade',
    url: 'www.radiomics.org/RO/7NFM',
    description:
      'The cluster shade is a measure of the skewness of the matrix and it is believed to gauge the perceptual concepts of uniformity. When the cluster age is high the image is asymmetric',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_ClusterTendency',
    url: 'www.radiomics.org/RO/DG8W',
    description:
      'The cluster tendency indicates into how many clusters the gray levels present in the image can be classified',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_Contrast',
    url: 'www.radiomics.org/RO/ACUI',
    description:
      'Contrast assesses grey level variations. It is defines as in https://doi.org/10.5589/m02-004',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_Correlation',
    url: 'www.radiomics.org/RO/NI2N',
    description:
      'The correlation feature shows the linear dependence of gray level values in the cooccurence matrix',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_DifferenceAverage',
    url: 'www.radiomics.org/RO/TF7R',
    description: 'The average for the diagonal probabilities',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_DifferenceEntropy',
    url: 'www.radiomics.org/RO/NTRS',
    description: 'The entropy for the diagonal probabilities',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_DifferenceVariance',
    url: 'www.radiomics.org/RO/D3YU',
    description: 'The variance for the diagonal probabilities',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_Id',
    url: 'www.radiomics.org/RO/IB1Z',
    description:
      'Inverse difference is a measure of homogeneity. Grey level co-occurrences with a large difference in levels are weighed less, thus lowering the total feature score. The feature score is maximal if all grey levels are the same',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_Idm',
    url: 'www.radiomics.org/RO/WF0Z',
    description:
      'Same as the inverse difference feature, but with lower weigths for elements that are further from the diagonal',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_Idmn',
    url: 'www.radiomics.org/RO/1QCO',
    description:
      'Normalized version of the inverse difference moment, as suggested by https://doi.org/10.5589/m02-004',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_Idn',
    url: 'www.radiomics.org/RO/NDRX',
    description:
      'Normalized inverse difference as suggested in https://doi.org/10.5589/m02-004',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_Imc1',
    url: 'www.radiomics.org/RO/R8DG',
    description:
      'The IMC1 is related to the entropy of the images and gives information on how a pixel value is correlated to its neighbourod',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_Imc2',
    url: 'www.radiomics.org/RO/JN9H',
    description: '???',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_InverseVariance',
    url: 'www.radiomics.org/RO/E8JP',
    description:
      'The inverse variance feature measures how the gray tone differences are distributed in pair elements',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_JointAverage',
    url: 'www.radiomics.org/RO/60VM',
    description: 'The grey level weigthed sum of joint probabilities',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_JointEnergy',
    url: 'www.radiomics.org/RO/8ZQL',
    description:
      'It represents the energy of the probability matrix. Please note that this feature is also called Energy or Uniformity.',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_JointEntropy',
    url: 'www.radiomics.org/RO/TU9B',
    description: 'As defined in http://dx.doi.org/10.1109/TSMC.1973.4309314',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_MaximumProbability',
    url: 'www.radiomics.org/RO/GYBY',
    description:
      'Probability corresponding to the most common grey level co-occurence in the GCLM',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_MCC',
    url: 'www.radiomics.org/RO/xxx',
    description: '???',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_SumAverage',
    url: 'www.radiomics.org/RO/ZGXS',
    description: 'The average for the cross-diagonal probabilities',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_SumEntropy',
    url: 'www.radiomics.org/RO/P6QZ',
    description: 'The entropy for the cross-diagonal probabilities',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'glcm_SumSquares',
    url: 'www.radiomics.org/RO/OEEB',
    description: 'The variance for the cross-diagonal probabilities',
    category: 'Texture',
    subcategory: 'GLCM',
  },
  {
    id: 'gldm_DependenceEntropy',
    url: 'www.radiomics.org/RO/GBDU',
    description: 'Entropy for the zone distances',
    category: 'Texture',
    subcategory: 'GLDM',
  },
  {
    id: 'gldm_DependenceNonUniformity',
    url: 'www.radiomics.org/RO/V294',
    description:
      'This features assesses the distribution of zone counts over the different zone distances. The feature value is low when zone counts are equally distributed along zone distances',
    category: 'Texture',
    subcategory: 'GLDM',
  },
  {
    id: 'gldm_DependenceNonUniformityNormalized',
    url: 'www.radiomics.org/RO/IATH',
    description:
      'This is the normalised version of the zone distance non-uniformity feature',
    category: 'Texture',
    subcategory: 'GLDM',
  },
  {
    id: 'gldm_DependenceVariance',
    url: 'www.radiomics.org/RO/7WT1',
    description:
      'This feature estimates the variance in zone counts for the different zone distances',
    category: 'Texture',
    subcategory: 'GLDM',
  },
  {
    id: 'gldm_GrayLevelNonUniformity',
    url: 'www.radiomics.org/RO/VFT7',
    description:
      'This feature assesses the distribution of zone counts over the grey values. The feature value is low when zone counts are equally distributed along grey levels',
    category: 'Texture',
    subcategory: 'GLDM',
  },
  {
    id: 'gldm_GrayLevelVariance',
    url: 'www.radiomics.org/RO/QK93',
    description:
      'This feature estimates the variance in zone counts for the grey levels',
    category: 'Texture',
    subcategory: 'GLDM',
  },
  {
    id: 'gldm_HighGrayLevelEmphasis',
    url: 'www.radiomics.org/RO/K26C',
    description: 'The feature emphasises high grey levels',
    category: 'Texture',
    subcategory: 'GLDM',
  },
  {
    id: 'gldm_LargeDependenceEmphasis',
    url: 'www.radiomics.org/RO/MB4I',
    description: 'This feature emphasises large distances',
    category: 'Texture',
    subcategory: 'GLDM',
  },
  {
    id: 'gldm_LargeDependenceHighGrayLevelEmphasis',
    url: 'www.radiomics.org/RO/KLTH',
    description:
      'This feature emphasises runs in the lower right quadrant of the GLDZM, where large zone distances and high grey levels are located',
    category: 'Texture',
    subcategory: 'GLDM',
  },
  {
    id: 'gldm_LargeDependenceLowGrayLevelEmphasis',
    url: 'www.radiomics.org/RO/A7WM',
    description:
      'This feature emphasises runs in the upper right quadrant of the GLDZM, where large zone distances and low grey levels are located.',
    category: 'Texture',
    subcategory: 'GLDM',
  },
  {
    id: 'gldm_LowGrayLevelEmphasis',
    url: 'www.radiomics.org/RO/S1RA',
    description:
      'Instead of small zone distances, low grey levels are emphasised',
    category: 'Texture',
    subcategory: 'GLDM',
  },
  {
    id: 'gldm_SmallDependenceEmphasis',
    url: 'www.radiomics.org/RO/0GBI',
    description: 'This feature emphasises small distances',
    category: 'Texture',
    subcategory: 'GLDM',
  },
  {
    id: 'gldm_SmallDependenceHighGrayLevelEmphasis',
    url: 'www.radiomics.org/RO/DKNJ',
    description:
      'This feature emphasises runs in the lower left quadrant of the GLDZM, where small zone distances and high grey levels are located',
    category: 'Texture',
    subcategory: 'GLDM',
  },
  {
    id: 'gldm_SmallDependenceLowGrayLevelEmphasis',
    url: 'www.radiomics.org/RO/RUVG',
    description:
      'This feature emphasises runs in the upper left quadrant of the GLDZM, where small zone distances and low grey levels are located',
    category: 'Texture',
    subcategory: 'GLDM',
  },
  {
    id: 'glrlm_GrayLevelNonUniformity',
    url: 'www.radiomics.org/RO/R5YN',
    description:
      'This feature assesses the distribution of runs over the grey values (Galloway, 1975). The feature value is low when runs are equally distributed along grey levels',
    category: 'Texture',
    subcategory: 'GLRLM',
  },
  {
    id: 'glrlm_GrayLevelNonUniformityNormalized',
    url: 'www.radiomics.org/RO/OVBL',
    description:
      'This is the normalised version of the grey level non-uniformity feature',
    category: 'Texture',
    subcategory: 'GLRLM',
  },
  {
    id: 'glrlm_GrayLevelVariance',
    url: 'www.radiomics.org/RO/8CE5',
    description:
      'This feature estimates the variance in runs for the grey levels',
    category: 'Texture',
    subcategory: 'GLRLM',
  },
  {
    id: 'glrlm_HighGrayLevelRunEmphasis',
    url: 'www.radiomics.org/RO/G3QZ',
    description:
      'The HGLRE measures  the distribution of high gray level values. The HGRE is high for the image with highgray level values',
    category: 'Texture',
    subcategory: 'GLRLM',
  },
  {
    id: 'glrlm_LongRunEmphasis',
    url: 'www.radiomics.org/RO/W4KF',
    description: 'The LRE measures the distribution of long runs',
    category: 'Texture',
    subcategory: 'GLRLM',
  },
  {
    id: 'glrlm_LongRunHighGrayLevelEmphasis',
    url: 'www.radiomics.org/RO/3KUM',
    description:
      'This feature emphasises runs in the lower right quadrant of the GLRLM, where long run lengths and high grey levels are located',
    category: 'Texture',
    subcategory: 'GLRLM',
  },
  {
    id: 'glrlm_LongRunLowGrayLevelEmphasis',
    url: 'www.radiomics.org/RO/IVPO',
    description:
      'This feature emphasises runs in the upper right quadrant of the GLRLM, where long run lengths and low grey levels are located',
    category: 'Texture',
    subcategory: 'GLRLM',
  },
  {
    id: 'glrlm_LowGrayLevelRunEmphasis',
    url: 'www.radiomics.org/RO/V3SW',
    description:
      'The LGLRE measures the distribution of low gray level values. The LGRE is high for the image with low gray level values',
    category: 'Texture',
    subcategory: 'GLRLM',
  },
  {
    id: 'glrlm_RunEntropy',
    url: 'www.radiomics.org/RO/HJ9O',
    description: '',
    category: 'Texture',
    subcategory: 'GLRLM',
  },
  {
    id: 'glrlm_RunLengthNonUniformity',
    url: 'www.radiomics.org/RO/W92Y',
    description:
      'This features assesses the distribution of runs over the run lengths (Galloway, 1975). The feature value is low when runs are equally distributed along run lengths.',
    category: 'Texture',
    subcategory: 'GLRLM',
  },
  {
    id: 'glrlm_RunLengthNonUniformityNormalized',
    url: 'www.radiomics.org/RO/IC23',
    description:
      'This is the normalised version of the run length non-uniformity feature',
    category: 'Texture',
    subcategory: 'GLRLM',
  },
  {
    id: 'glrlm_RunPercentage',
    url: 'www.radiomics.org/RO/9ZK5',
    description:
      'This feature assesses the fraction of the number of realised runs and the maximum number of potential runs (Galloway, 1975). Strongly linear or highly uniform ROI volumes produce a low run percentage',
    category: 'Texture',
    subcategory: 'GLRLM',
  },
  {
    id: 'glrlm_RunVariance',
    url: 'www.radiomics.org/RO/SXLW',
    description: 'This feature estimates the variance in runs for run lengths',
    category: 'Texture',
    subcategory: 'GLRLM',
  },
  {
    id: 'glrlm_ShortRunEmphasis',
    url: 'www.radiomics.org/RO/22OV',
    description:
      'The SRE measures the distribution of short runs. The SRE is highly dependent on the occurrence of short runs and it gives high value for fine texture the value of SRE is high',
    category: 'Texture',
    subcategory: 'GLRLM',
  },
  {
    id: 'glrlm_ShortRunHighGrayLevelEmphasis',
    url: 'www.radiomics.org/RO/GD3A',
    description:
      'The SRHGLE measures the joint distribution of short runs and high gray level values. The SRHGE is high for the image with many short runs and high gray level values',
    category: 'Texture',
    subcategory: 'GLRLM',
  },
  {
    id: 'glrlm_ShortRunLowGrayLevelEmphasis',
    url: 'www.radiomics.org/RO/HTZT',
    description:
      'The SRLGLE measures the joint distribution of short runs and low gray level values. The SRLGE is high for the image with many short runs and lower gray level values',
    category: 'Texture',
    subcategory: 'GLRLM',
  },
  {
    id: 'glszm_GrayLevelNonUniformity',
    url: 'www.radiomics.org/RO/JNSA',
    description:
      'This feature assesses the distribution of zone counts over the grey values. The feature value is low when zone counts are equally distributed along grey levels',
    category: 'Texture',
    subcategory: 'GLSZM',
  },
  {
    id: 'glszm_GrayLevelNonUniformityNormalized',
    url: 'www.radiomics.org/RO/Y1RO',
    description:
      'This is a normalised version of the grey level non-uniformity feature',
    category: 'Texture',
    subcategory: 'GLSZM',
  },
  {
    id: 'glszm_GrayLevelVariance',
    url: 'www.radiomics.org/RO/BYLV',
    description:
      'This feature estimates the variance in zone counts for the grey levels',
    category: 'Texture',
    subcategory: 'GLSZM',
  },
  {
    id: 'glszm_HighGrayLevelZoneEmphasis',
    url: 'www.radiomics.org/RO/5GN9',
    description:
      'Measures the distribution of the higher gray-level values, with a higher value indicating a greater proportion of higher gray-level values and size zones in the image',
    category: 'Texture',
    subcategory: 'GLSZM',
  },
  {
    id: 'glszm_LargeAreaEmphasis',
    url: 'www.radiomics.org/RO/48P8',
    description: 'This feature emphasises large zones',
    category: 'Texture',
    subcategory: 'GLSZM',
  },
  {
    id: 'glszm_LargeAreaHighGrayLevelEmphasis',
    url: 'www.radiomics.org/RO/J17V',
    description:
      'This feature emphasises runs in the lower right quadrant of the GLSZM, where large zone sizes and high grey levels are located',
    category: 'Texture',
    subcategory: 'GLSZM',
  },
  {
    id: 'glszm_LargeAreaLowGrayLevelEmphasis',
    url: 'www.radiomics.org/RO/YH51',
    description:
      'This feature emphasises runs in the upper right quadrant of the GLSZM, where large zone sizes and low grey levels are located',
    category: 'Texture',
    subcategory: 'GLSZM',
  },
  {
    id: 'glszm_LowGrayLevelZoneEmphasis',
    url: 'www.radiomics.org/RO/XMSY',
    description:
      'Measures the distribution of lower gray-level size zones, with a higher value indicating a greater proportion of lower gray-level values and size zones in the image',
    category: 'Texture',
    subcategory: 'GLSZM',
  },
  {
    id: 'glszm_SizeZoneNonUniformity',
    url: 'www.radiomics.org/RO/4JP3',
    description:
      'This features assesses the distribution of zone counts over the different zone sizes. The feature value is low when zone counts are equally distributed along zone sizes',
    category: 'Texture',
    subcategory: 'GLSZM',
  },
  {
    id: 'glszm_SizeZoneNonUniformityNormalized',
    url: 'www.radiomics.org/RO/VB3A',
    description:
      'This is a normalised version of the zone size non-uniformity feature',
    category: 'Texture',
    subcategory: 'GLSZM',
  },
  {
    id: 'glszm_SmallAreaEmphasis',
    url: 'www.radiomics.org/RO/5QRC',
    description: 'This feature emphasises small zones',
    category: 'Texture',
    subcategory: 'GLSZM',
  },
  {
    id: 'glszm_SmallAreaHighGrayLevelEmphasis',
    url: 'www.radiomics.org/RO/HW1V',
    description:
      'This feature emphasises runs in the lower left quadrant of the GLSZM, where small zone sizes and high grey levels are located',
    category: 'Texture',
    subcategory: 'GLSZM',
  },
  {
    id: 'glszm_SmallAreaLowGrayLevelEmphasis',
    url: 'www.radiomics.org/RO/5RAI',
    description:
      'This feature emphasises runs in the upper left quadrant of the GLSZM, where small zone sizes and low grey levels are located',
    category: 'Texture',
    subcategory: 'GLSZM',
  },
  {
    id: 'glszm_ZoneEntropy',
    url: 'www.radiomics.org/RO/GU8N',
    description: 'Entropy related to the zone sizes',
    category: 'Texture',
    subcategory: 'GLSZM',
  },
  {
    id: 'glszm_ZonePercentage',
    url: 'www.radiomics.org/RO/P30P',
    description:
      'This feature assesses the fraction of the number of realised zones and the maximum num- ber of potential zones. Strongly linear or highly uniform ROI volumes produce a low zone percentage',
    category: 'Texture',
    subcategory: 'GLSZM',
  },
  {
    id: 'glszm_ZoneVariance',
    url: 'www.radiomics.org/RO/3NSA',
    description:
      'This feature estimates the variance in zone counts for the different zone sizes',
    category: 'Texture',
    subcategory: 'GLSZM',
  },
  {
    id: 'ngtdm_Busyness',
    url: 'www.radiomics.org/RO/NQ30',
    description:
      'Textures with large changes in grey levels between neighbouring voxels are called busy',
    category: 'Texture',
    subcategory: 'NGTDM',
  },
  {
    id: 'ngtdm_Coarseness',
    url: 'www.radiomics.org/RO/QCDE',
    description:
      'Grey level differences in coarse textures are generally small due to large-scale patterns. Summing differences gives an indication of the level of the spatial rate of change in intensity',
    category: 'Texture',
    subcategory: 'NGTDM',
  },
  {
    id: 'ngtdm_Complexity',
    url: 'www.radiomics.org/RO/HDEZ',
    description:
      'Complex textures are non-uniform and rapid changes in grey levels are common',
    category: 'Texture',
    subcategory: 'NGTDM',
  },
  {
    id: 'ngtdm_Contrast',
    url: 'www.radiomics.org/RO/65HE',
    description:
      'Contrast depends on the dynamic range of the grey levels as well as the spatial frequency of intensity changes',
    category: 'Texture',
    subcategory: 'NGTDM',
  },
  {
    id: 'ngtdm_Strength',
    url: 'www.radiomics.org/RO/1X9X',
    description:
      'Feature defined in http://dx.doi.org/10.1371/journal.pone.0093600',
    category: 'Texture',
    subcategory: 'NGTDM',
  },
  {
    id: 'shape_Maximum3DDiameter',
    url: 'www.radiomics.org/RO/L0JK',
    description:
      'The maximum 3D diameter is the distance between the two most distant vertices in the ROI mesh vertices sets',
    category: 'Shape',
    subcategory: '',
  },
  {
    id: 'shape_MeshVolume',
    url: 'www.radiomics.org/RO/RNU0',
    description:
      'The volume V is calculated from the ROI mesh as indicated in https://doi.org/10.1109/ICIP.2001.958278',
    category: 'Shape',
    subcategory: '',
  },
  {
    id: 'shape_MajorAxisLength',
    url: 'www.radiomics.org/RO/TDIC',
    description:
      'The major axis length is defined as twice the semi-axis length, dtermined using the largest eigenvalue obtained by principal component analysis (PCA) on the point set of voxel centers',
    category: 'Shape',
    subcategory: '',
  },
  {
    id: 'shape_Sphericity',
    url: 'www.radiomics.org/RO/QCFX',
    description:
      'Sphericity is a further measure to describe how sphere-like the volume is',
    category: 'Shape',
    subcategory: '',
  },
  {
    id: 'shape_LeastAxisLength',
    url: 'www.radiomics.org/RO/7J51',
    description:
      'The least axis is the the axis along which the object is least extended. The least axis is twice the semi-axis length, determined using the smallest eigenvalue obtained by PCA on the point set of voxel centers',
    category: 'Shape',
    subcategory: '',
  },
  {
    id: 'shape_Elongation',
    url: 'www.radiomics.org/RO/Q3CK',
    description:
      'Elongation is the ratio between the major and minor axis lengths. Elongation is espressed as inversed ratio: 1 means completely not elongated (e.g. a sphere). Smaller values express greater elongation of the ROI volume',
    category: 'Shape',
    subcategory: '',
  },
  {
    id: 'shape_SurfaceVolumeRatio',
    url: 'www.radiomics.org/RO/2PR5',
    description:
      'The surface to volume ratio is the ratio between the Surface and the Volume',
    category: 'Shape',
    subcategory: '',
  },
  {
    id: 'shape_Maximum2DDiameterSlice',
    url: 'www.radiomics.org/RO/2130',
    description:
      'Maximum 2D diameter (Slice) is defined as the largest pairwise Euclidean distance between tumor surface voxels in the row-column (generally the axial) plane.',
    category: 'Shape',
    subcategory: '',
  },
  {
    id: 'shape_Flatness',
    url: 'www.radiomics.org/RO/N17B',
    description:
      'The flatness is the ratio of the major and the least axis lengths. The flatness is expressed as an inverse ratio: 1 completely not flat; smaller values express objects which are increasingly flatter',
    category: 'Shape',
    subcategory: '',
  },
  {
    id: 'shape_SurfaceArea',
    url: 'www.radiomics.org/RO/C0JK',
    description:
      'The surface area is calculated from the ROI mesh, by summing over the face area surfaces',
    category: 'Shape',
    subcategory: '',
  },
  {
    id: 'shape_MinorAxisLength',
    url: 'www.radiomics.org/RO/P9VJ',
    description:
      'The minor axis length of the ROI provides a measure of how fare the volume extends along the second largest axis. The minor axis length is twice the semi-axis length, determined using the second largest eigenvalue obtained by PCA on the point of the voxel centers',
    category: 'Shape',
    subcategory: '',
  },
  {
    id: 'shape_Maximum2DDiameterColumn',
    url: 'www.radiomics.org/RO/2150',
    description:
      'Maximum 2D diameter (Column) is defined as the largest pairwise Euclidean distance between tumor surface voxels in the row-slice (usually the coronal) plane.',
    category: 'Shape',
    subcategory: '',
  },
  {
    id: 'shape_Maximum2DDiameterRow',
    url: 'www.radiomics.org/RO/2140',
    description:
      'Maximum 2D diameter (Row) is defined as the largest pairwise Euclidean distance between tumor surface voxels in the column-slice (usually the sagittal) plane.',
    category: 'Shape',
    subcategory: '',
  },
  {
    id: 'shape_VoxelVolume',
    url: 'www.radiomics.org/RO/RNU0',
    description:
      'The volume V is calculated from the ROI mesh as indicated in https://doi.org/10.1109/ICIP.2001.958278',
    category: 'Shape',
    subcategory: '',
  },
];

export const CATEGORY_DEFINITIONS = {
  // Modalities
  CT: 'Computed Tomography',
  PT: 'Positron emission tomography',
  MR: 'Magnetic resonance imaging',
  // Families
  Intensity:
    'Features based on the grey levels of the pixels in the image (maximum, minimum, mean, etc.)',
  SUV: 'Features based on the grey levels of the pixels in the image (maximum, minimum, mean, etc.)',
  Texture:
    'The textural features describe patterns or the spatial distribution of voxel intensities',
  Shape:
    'Morphological features describe geometric aspects of a region of interest (ROI), such as area and volume. Morphological features are based on ROI voxel representations of the volume.',
  // Sub-families
  GLCM: 'The grey level co-occurrence matrix (GLCM) is a matrix that expresses how combinations of discretised grey levels of neighbouring pixels, or voxels in a 3D volume, are distributed along one of the image directions. In a 3 dimensional approach to texture analysis, the direct neighbourhood of a voxel consists of the 26 directly neighbouring voxels. Thus, there are 13 unique direction vectors within a neighbourhood volume for distance',
};

export const FEATURE_CATEGORY_ALIASES = {
  PT: { Intensity: 'SUV' },
};
