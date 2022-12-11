/*
Layouts element

- ThemeRoot dataNode
  - Rel descendents :  [...]
  - Rel styles: [css files]
  - Rel views: [html files: {id, fileName, path, relPath}]

id is the filename without the extension

We need the root theme as well as the subtheme (activeTheme) because we would need to search at parent layouts for files not present at subtheme.
*/

import {default as readTree} from './layoutfolderread.mjs';
import * as fs from 'fs';
import * as path from 'path';

export default class SiteLayout {
  constructor(layoutsPath){
    this.treeRoot;
    this.layoutsPath=layoutsPath;
  }
  readTree(themeId='root'){
    this.treeRoot=readTree(path.join(this.layoutsPath, themeId));
  }
  getTpFilesList(themeId, subThemeId, excluded=false) {
    if (!this.treeRoot || this.treeRoot.props.id!=themeId) this.readTree(themeId);
    let active = this.treeRoot;
    if (subThemeId) active = this.findTheme(subThemeId);
    return getTpFilesList(this.layoutsPath, active, excluded);
  }
  getCssFilesList(themeId, subThemeId) {
    if (!this.treeRoot || this.treeRoot.props.id!=themeId) this.readTree(themeId);
    let active = this.treeRoot;
    if (subThemeId) active = this.findTheme(subThemeId);
    return getCssFilesList(this.layoutsPath, active);
  }
  getContent(themeId, subThemeId) {
    return Array.from(this.getTpFilesList(themeId, subThemeId)).reduce((cc, [tpId, tpFilePath])=>cc+=getTp(tpId, tpFilePath), '');
    //header('Access-Control-Allow-Origin: *'); //To allow use of external
  }
  getTpContent(tpId, themeId, subThemeId){
    return getTp(tpId, this.getTpFilesList(themeId, subThemeId, true).get(tpId));
  }
  getCssImagePath(imageId, themeId, subThemeId){
    const fileList=this.getCssFilesList(themeId, subThemeId);
    return fileList.get(imageId);
  }
  // It searchs for the theme (child of descendents) from prop id as search
  findTheme(search) {
    if (typeof search== "string") search={id: search};
    if (!search) {
      return this.treeMum.getChild();
    }
    function innerFind(search, myTree) {
      if (!myTree) return;
      if (Object.entries(search).every(srch=>Object.entries(myTree.props).find(src=>srch[0]==src[0] && src[1]==srch[1]))) {
        return myTree;
      }
      for (const child of myTree.getRelationship("descendents").children) {
        let result=innerFind(search, child);
        if (result) return result;
      }
    }
    return innerFind(search, this.treeMum.getChild());
  }
  getCssContent(styleId, themeId, subThemeId){
    if (!this.treeRoot || this.treeRoot.props.id!=themeId) this.readTree(themeId);
    let active = this.treeRoot;
    if (subThemeId) active = this.findTheme(subThemeId);
    const cssContent= getCss(getCommonStyle(this.layoutsPath, active)) + getCss(getStyle(this.layoutsPath, styleId, active));
    return encondeCssImageNames(cssContent, themeId, subThemeId);
  }
}

function getTp(tpId, tpFilePath) {
  if (!fs.statSync(tpFilePath).isFile()) throw new Error('No Tp File: ', tpFilePath);
  return "<template id='tp" + tpId + "'>\n" + fs.readFileSync(tpFilePath, {encoding: "utf8"}) + "\n</template>\n";
}
function getCss(cssFilePath) {
  if (!cssFilePath) return '';
  return "<style>\n" + fs.readFileSync(cssFilePath, {encoding: "utf8"}) + "\n</style>\n";
}

export function decodeCssImageUrlPath(/*string*/imageUrlPath){
  const imageFileName=path.parse(imageUrlPath).name;
  let [imageId, themeId, subThemeId]=imageFileName.split('_');
  const ImageData=new Map([["imageId", imageId],["themeId", themeId],["subThemeId", subThemeId]]);
  return ImageData;
}

function encondeCssImageNames(/*string*/cssContent, /*string*/themeId, /*string*/subThemeId){
  let searchParams='';
  if (themeId) searchParams += '_' + themeId;
  if (subThemeId) searchParams += '_' + subThemeId;
  return cssContent.replaceAll('.svg', searchParams + '.svg');
}

// It creates a list of templates files with paths from the theme tree
// ***** It uses inheritance at templates not present at child layouts
// Option includeSubs is to include template files at subfolders of the view folder. We usually reserve the subfolder to save the templates that are not loaded with the others at the begining because they are not often accesed.
function getTpFilesList(layoutsPath, myTheme, includeSubs=false) {
  return getFilesList(layoutsPath, "views", myTheme, includeSubs);
}

function getCssFilesList(layoutsPath, myTheme) {
  return getFilesList(layoutsPath, "styles", myTheme, true);
}

function getFilesList(/*string*/layoutsPath, /*string*/folderName, myTheme, includeSubs=false) {
  let pointer=myTheme;
  const result=new Map();
  while (pointer) {
    if (!pointer.getRelationship(folderName)) break;
    for (const child of pointer.getRelationship(folderName).children) {
      if (includeSubs || !child.props.relPath.match(/.+\/.+/)) { //exclude files in subfolders
        if (!result.has(child.props.id)) result.set(child.props.id, path.join(layoutsPath, child.props.path, child.props.fileName));
      }
    }
    if (pointer.parent) pointer=pointer.parent.partner;
    else break;
  }
  return result;
}

// common style can be at the activetheme or if not it search in ascendents
function getCommonStyle(layoutsPath, activeTheme){
  return getStyle(layoutsPath, "common", activeTheme)
}

function getStyle(layoutsPath, styleId, activeTheme) {
  const myList = getCssFilesList(layoutsPath, activeTheme);
  return myList.get(styleId);
}