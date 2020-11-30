﻿///<reference path="example.ts" />

//import sgl = require('./app');
//sgl.setGraphLocation(grp);

////グラフの描画をするための変数
var canvas = <HTMLCanvasElement>document.getElementById("cv");
var context = canvas.getContext("2d");
context.font = "italic 50px Arial";

setGraphLocation(grp);
grp.draw(context);

console.log(grp);




//Kanonからgraphオブジェクトを受け取り、graphオブジェクト内のノードの座標を更新する関する（メイン関数）
function setGraphLocation(graph: Graph) {

    //スタックの実装
    class Stack {
        stack: string[];

        constructor() {
            this.stack = new Array();
        }

        //プッシュ
        push(str: string) {
            this.stack.push(str);
        }

        //ポップ
        pop(): string {
            if (this.stack.length == 0) {
                return null;
            } else {
                var p: string = this.stack.pop();
                return p;
            }
        }

        //スタックの中身が空の場合、trueを返す
        isZero(): boolean {
            return this.stack.length == 0;
        }

        //スタックされている値を配列として返す
        returnArray(): string[] {
            return copyArray(this.stack);
        }
    }

    /*
     * クラス名とフィールド名をまとめてクラス定義する
     */
    class ClassAndField {
        parentcls: string;
        childcls: string;
        field: string;
        angle: number;

        constructor(pcls: string, ccls: string, field: string) {
            this.parentcls = pcls;
            this.childcls = ccls;
            this.field = field;
            this.angle = 0;
        }
    }

    //角度付きエッジのクラス
    class EdgeWithAngle {
        ID1: string;
        ID2: string;
        fromtype: string;
        totype: string;
        fieldname: string;
        underforce: boolean;

        constructor(ID1: string, ID2: string, fromtype: string, totype: string, fieldname: string) {
            this.ID1 = ID1;
            this.ID2 = ID2;
            this.fromtype = fromtype;
            this.totype = totype;
            this.fieldname = fieldname;
            this.underforce = true;
        }
    }

    //配列内に引数と同じ値があるかどうかを走査する
    function sameT_InArray<T>(t: T, arrayT: T[]): boolean {
        var bool: boolean = false;

        for (var i = 0; i < arrayT.length; i++) {
            bool = bool || (arrayT[i] == t);
        }

        return bool;
    }

    //ClassAndFieldの配列内に引数と同じ値があるかどうかを走査する
    function sameClassAndField_InArray(caf: ClassAndField, arrayCaf: ClassAndField[]): boolean {
        var bool: boolean = false;

        for (var i = 0; i < arrayCaf.length; i++) {
            bool = bool || (caf.parentcls == arrayCaf[i].parentcls && caf.childcls == arrayCaf[i].childcls && caf.field == arrayCaf[i].field);
        }

        return bool;
    }

    //配列を別の配列にコピーする
    function copyArray(origin: string[]): string[] {
        var array: string[] = new Array(origin.length);
        for (var i = 0; i < origin.length; i++) {
            array[i] = origin[i];
        }
        return array;
    }

    //配列同士が同じものであるかどうかを調べる
    function arrayEqual(a1: string[], a2: string[]): boolean {
        var bool: boolean = true;
        if (a1.length != a2.length) {
            return false;
        } else {
            for (var i = 0; i < a1.length; i++) {
                bool = bool && (a1[i] === a2[i]);
            }
            return bool;
        }
    }

    //値から配列の最初のkeyを取得し、keyより前の要素を削除した配列を返す
    function arraySpliceBoforeIndexOf(key: string, array: string[]): string[] {
        var carray: string[] = copyArray(array);
        var index: number = carray.indexOf(key);
        carray.splice(0, index);
        return carray;
    }

    //与えられたエッジオブジェクトが与えられたクラスフィールドに属しているかを判定する
    function edgeIncludeCaF(edge: EdgeWithAngle, caf: ClassAndField) {
        return edge.fromtype == caf.parentcls && edge.totype == caf.childcls && edge.fieldname == caf.field;
    }




    //角度付きエッジリストの情報をEdgeWithAngleとして書きこむ
    function edgeListInit(graph: Graph, edgelist: EdgeWithAngle[], caflist: ClassAndField[], drawcircle: boolean, edgewithprimitivevalue: boolean) {

        //オブジェクトのIDの配列
        var ObjectIDs: string[] = graph.getObjectIDs();

        for (var i = 0; i < ObjectIDs.length; i++) {
            //ID1(始点ノード)のIDとクラス
            var ID1: string = ObjectIDs[i];
            var ID1type: string = graph.getClass(ID1);

            //ID1の持つフィールドの列
            var fields: string[] = graph.getFields(ID1);
            for (var j = 0; j < fields.length; j++) {
                var fieldname: string = fields[j];
                var ID2: string = graph.getField(ID1, fieldname);
                var ID2type: string = graph.getClass(ID2);
                edgelist.push(new EdgeWithAngle(ID1, ID2, ID1type, ID2type, fieldname));
                if (edgewithprimitivevalue == false) {      //プリミティブ型を指すフィールドエッジに角度力を働かせない
                    edgelist[edgelist.length - 1].underforce = false;
                }
            }
        }

        //必要なフィールド名
        for (var i = 0; i < edgelist.length; i++) {
            var caf: ClassAndField = new ClassAndField(edgelist[i].fromtype, edgelist[i].totype, edgelist[i].fieldname);
            if (!sameClassAndField_InArray(caf, caflist)) {
                caflist.push(caf);
            }
        }
        necessaryCaFList(graph, caflist, ObjectIDs);

        //必要なフィールド名以外のエッジを削除する
        for (var i = edgelist.length - 1; i >= 0; i--) {
            var bool: boolean = false;
            for (var j = 0; j < caflist.length; j++) {
                bool = bool || edgeIncludeCaF(edgelist[i], caflist[j]);
            }

            if (bool == false) {
                edgelist.splice(i, 1);
            }
        }

        //閉路上のエッジに働かせる角度力を無くす
        if (drawcircle) {
            for (var i = 0; i < caflist.length; i++) {
                if (caflist[i].parentcls == caflist[i].childcls) {
                    searchCycleGraph(graph, edgelist, caflist[i].parentcls, ObjectIDs, caflist);
                }
            }
        }
    }

    //交互参照しているフィールドを発見し、削除する
    function necessaryCaFList(graph: Graph, caflist: ClassAndField[], ObjectIDs: string[]) {
        for (var i = caflist.length - 1; i >= 0; i--) {
            var caf1: ClassAndField = caflist[i];
            var near_caf1: ClassAndField[] = new Array();       //caf1と逆の（型）→（型）を持つフィールド名の集合
            for (var j = 0; j < caflist.length; j++) {
                if (caflist[j] != caf1 && caflist[j].parentcls == caf1.childcls && caflist[j].childcls == caf1.parentcls) {
                    near_caf1.push(caflist[j]);
                }
            }

            var bool: boolean = true;
            for (var j = 0; j < near_caf1.length; j++) {
                bool = bool && isOverlapping(graph, caf1, near_caf1[j]);
            }

            if (bool && near_caf1.length != 0) {
                caflist.splice(i, 1);
            }
        }

        /*
         * 補助関数
         * 二つのClassAndFieldのx,yを受け取り、yに該当するエッジを全探索する
         * yのエッジが全てxのエッジの逆向きエッジであるならばtrueを返り値として返す
         */
        function isOverlapping(graph: Graph, cafx: ClassAndField, cafy: ClassAndField): boolean {
            var bool: boolean = true;
            for (var i = 0; i < ObjectIDs.length; i++) {
                var ID1: string = ObjectIDs[i];
                if (graph.getClass(ID1) == cafy.parentcls) {
                    var ID2: string = graph.getField(ID1, cafy.field);
                    if (ID2 != undefined && graph.getClass(ID2) == cafy.childcls) {
                        var nextID: string = graph.getField(ID2, cafx.field);
                        bool = bool && nextID == ID1;
                    }
                }
            }
            return bool;
        }
    }

    /*
     * 閉路を探索する
     * drawcircleがtrueの場合、閉路上のエッジの角度を全て無効にする
     * drawcircleがfalseの場合、閉路上のエッジを一本削除する
     */
    function searchCycleGraph(graph: Graph, edgelist: EdgeWithAngle[], cls: string, IDs: string[], arrayField: ClassAndField[]) {

        //閉路上のIDの配列
        var cycleIDs: string[][] = cycleGraphIDs(graph, cls, IDs, arrayField);
        //console.log(cycleIDs);

        for (var i = 0; i < cycleIDs.length; i++) {
            for (var j = 0; j < cycleIDs[i].length - 1; j++) {
                for (var k = 0; k < edgelist.length; k++) {
                    if (cycleIDs[i][j] == edgelist[k].ID1 && cycleIDs[i][j + 1] == edgelist[k].ID2) {
                        edgelist[k].underforce = false;
                    }
                }
            }
        }


        //補助関数、閉路を探索し、閉路上のIDの配列を返す
        function cycleGraphIDs(graph: Graph, cls: string, IDs: string[], arrayField: ClassAndField[]): string[][] {
            var cycleIDs: string[][] = new Array();

            var usedIDs: string[] = new Array();        //訪れたことのあるIDを記録

            for (var i = 0; i < IDs.length; i++) {
                if (!sameT_InArray<string>(IDs[i], usedIDs)) {
                    var cycleIDsFromOneID: string[][] = cycleGraphIDsFromOneID(graph, cls, usedIDs, arrayField, IDs[i]);
                    for (var j = 0; j < cycleIDsFromOneID.length; j++) {
                        cycleIDs.push(cycleIDsFromOneID[j]);
                    }
                }
            }

            return cycleIDs;

            //補助関数の補助関数、一つのIDから探索していき、見つかった閉路上のIDの配列を返す（深さ優先探索）
            function cycleGraphIDsFromOneID(graph: Graph, cls: string, usedIDs: string[], arrayField: ClassAndField[], ID: string): string[][] {

                var cycleIDs: string[][] = new Array();

                var stack: Stack = new Stack();     //経路を記録するためのスタック

                deep_first_search(graph, stack, cycleIDs, usedIDs, arrayField, ID);


                //補助関数、深さ優先探索的（厳密には違う）にノードを辿っていく
                function deep_first_search(graph: Graph, stack: Stack, cycleIDs: string[][], usedIDs: string[], arrayField: ClassAndField[], nowID: string) {

                    stack.push(nowID);

                    if (!sameT_InArray<string>(nowID, usedIDs)) {      //今いるノードが未訪問ならば訪問した印をつける
                        usedIDs.push(nowID);
                    }

                    for (var i = 0; i < arrayField.length; i++) {
                        var u: string = graph.getField(nowID, arrayField[i].field);
                        if (u != undefined) {
                            if (!sameT_InArray<string>(u, stack.stack)) {
                                deep_first_search(graph, stack, cycleIDs, usedIDs, arrayField, u);
                            } else {
                                var cycleInStack: string[] = arraySpliceBoforeIndexOf(u, stack.stack);
                                cycleIDs.push(cycleInStack);
                                cycleIDs[cycleIDs.length - 1].push(u);
                            }
                        }
                    }

                    stack.pop();
                }

                return cycleIDs;

            }
        }
    }

    //角度付きエッジリストを元に、力学的手法を用いて各ノードの座標を計算
    //graphオブジェクト内のノード座標を破壊的に書き替える
    function calculateLocationWithForceDirectedMethod(graph: Graph, edgeWithAngleList: EdgeWithAngle[], caflist: ClassAndField[]) {

        //オブジェクトのIDの配列
        var ObjectIDs: string[] = graph.getObjectIDs();

        //ノード数
        var DOTNUMBER: number = ObjectIDs.length;

        //エッジ数
        var EDGENUMBER: number = edgeWithAngleList.length;

        var WIDTH: number = 1280;    //表示する画面の横幅
        var HEIGHT: number = 720;     //表示する画面の縦幅
        //var K: number = Math.min(WIDTH, HEIGHT) / 50;   //クーロン力に係る係数
        var K: number = 100;   //クーロン力に係る係数
        //var Knum: number = 8;       //斥力のKの次数
        //var rnum: number = 3;       //斥力のrの次数
        var ravenum: number = (Knum + 1) / (rnum + 2);
        //var KRAD: number = 300000.0 * Math.PI * Math.PI / (180 * 180);      //角度に働く力の係数(弧度法から度数法に変更)
        var ITERATION: number = 8000;        //反復回数
        var T: number = Math.max(WIDTH, HEIGHT);         //温度パラメータ
        var t: number = T;
        var dt: number = T / (ITERATION);

        var K: number = 150;   //クーロン力に係る係数
        var Knum: number = 5;       //斥力のKの次数
        var rnum: number = 4;       //斥力のrの次数
        var KRAD: number = 0.5;      //角度に働く力の係数(弧度法から度数法に変更)

        //フロイドワーシャル法で各点同士の最短経路長を求める
        var dddd: number[] = new Array(DOTNUMBER * DOTNUMBER);
        FloydWarshall(DOTNUMBER, EDGENUMBER, dddd);

        //点のクラス
        class Dot_G {
            x: number;
            y: number;
            dx: number;     //速度のx成分
            dy: number;     //速度のy成分
            fax: number;    //引力のx成分
            fay: number;    //引力のy成分
            frx: number;    //斥力のx成分
            fry: number;    //斥力のy成分
            fmx: number;    //モーメントのx成分
            fmy: number;    //モーメントのy成分
            nodenum: number | string;    //点をノードと見なした時の中身の変数
            nodecls: string;            //点をノードと見なした時のクラス名

            //点の初期化
            init(x: number, y: number, cls: string) {
                this.x = x;
                this.y = y;
                this.dx = 0;
                this.dy = 0;
                this.fax = 0;
                this.fay = 0;
                this.frx = 0;
                this.fry = 0;
                this.fmx = 0;
                this.fmy = 0;
                this.nodecls = cls;
            }
            
            //点に働く力から速度を求める
            init_velocity() {
                this.dx = this.fax + this.frx + this.fmx;
                this.dy = this.fay + this.fry + this.fmy;
            }

            //点の速度
            velocity(): number {
                return Math.sqrt(this.dx * this.dx + this.dy * this.dy);
            }

            //力のベクトルの描画
            //drawForceVector() {
            //    context.strokeStyle = "rgba(255, 0, 0, 0.5)";
            //    context.fillStyle = "rgba(255, 0, 0, 0.5)";
            //    draw_vector(this.x, this.y, this.fax, this.fay);    //引力ベクトルは赤で表示
            //    context.strokeStyle = "rgba(0, 255, 0, 0.5)";
            //    context.fillStyle = "rgba(0, 255, 0, 0.5)";
            //    draw_vector(this.x, this.y, this.frx, this.fry);    //斥力ベクトルは緑で表示
            //    context.strokeStyle = "rgba(0, 0, 255, 0.5)";
            //    context.fillStyle = "rgba(0, 0, 255, 0.5)";
            //    draw_vector(this.x, this.y, this.fmx, this.fmy);    //角度力ベクトルは青で表示
            //}
        }

        //補助クラス、ベクトルのクラス
        class Vector_G {
            x: number;
            y: number;

            constructor(x: number, y: number) {
                this.x = x;
                this.y = y;
            }

            //２ベクトルの加算
            sum(vec2: Vector_G): Vector_G {
                return new Vector_G(this.x + vec2.x, this.y + vec2.y);
            }

            //ベクトルの角度を計算する
            angle(): number {
                var angle: number = Math.atan2(this.y, this.x) * 180 / Math.PI;
                return angle;
            }
        }

        //辺のクラス
        class Edge_G {
            dot1: Dot_G;
            dot2: Dot_G;
            dot1cls: string;
            dot2cls: string;
            edgename: string;   //エッジの名前（フィールド名）

            //辺の初期化
            init(dot1: Dot_G, dot2: Dot_G, edgename: string) {
                this.dot1 = dot1;
                this.dot2 = dot2;
                this.dot1cls = dot1.nodecls;
                this.dot2cls = dot2.nodecls;
                this.edgename = edgename;
            }

            //エッジの長さ（2点間の距離）を求める
            length(): number {
                var xl: number = this.dot1.x - this.dot2.x;
                var yl: number = this.dot1.y - this.dot2.y;

                return Math.sqrt(xl * xl + yl * yl);
            }

            //エッジの角度を計算する
            angle(): number {
                var dx: number = this.dot2.x - this.dot1.x;
                var dy: number = this.dot2.y - this.dot1.y;
                var delta: number = Math.sqrt(dx * dx + dy * dy);
                var angle: number = Math.atan2(dy, dx) * 180 / Math.PI;
                return angle;
            }

            //エッジと同じ角度の単位ベクトルを返す
            unitVector(): Vector_G {
                var dx: number = this.dot2.x - this.dot1.x;
                var dy: number = this.dot2.y - this.dot1.y;
                var delta: number = Math.sqrt(dx * dx + dy * dy);
                if (delta != 0) {
                    return new Vector_G(dx / delta, dy / delta);
                } else {
                    return new Vector_G(0, 0);
                }
            }
        }

        //グラフのクラス
        class Graph_G {
            dot_number: number;
            edge_number: number;
            edges: Edge_G[];
            dots: Dot_G[];

            //グラフの初期化
            init(dn: number, en: number, edges: Edge_G[], dots: Dot_G[]) {
                this.dot_number = dn;
                this.edge_number = en;
                this.edges = edges;
                this.dots = dots;
            }

            //グラフの全てのエッジの長さの合計を出す
            sum_length(): number {
                var gl: number = 0;
                for (var i = 0; i < this.edge_number; i++) {
                    gl += this.edges[i].length();
                }

                return gl;
            }

            //力のベクトルの描画
            //drawForceVector() {
            //    for (var i = 0; i < this.dots.length; i++) {
            //        this.dots[i].drawForceVector();
            //    }
            //}
        }

        //各点の用意、座標は適切に初期化し、同じ座標の点同士が存在しないようにする
        var dots: Dot_G[] = new Array(DOTNUMBER);
        for (var i = 0; i < DOTNUMBER; i++) {
            dots[i] = new Dot_G();
        }
        do {
            for (var i = 0; i < DOTNUMBER; i++) {
                dots[i].init(Math.floor(Math.random() * WIDTH), Math.floor(Math.random() * HEIGHT), graph.getClass(ObjectIDs[i]));
            }
        } while (sameDot_exists(dots, DOTNUMBER));

        //各辺の用意
        var edges: Edge_G[] = new Array(EDGENUMBER);
        for (var i = 0; i < EDGENUMBER; i++) {
            edges[i] = new Edge_G();
            edges[i].init(dots[ObjectIDs.indexOf(edgeWithAngleList[i].ID1)], dots[ObjectIDs.indexOf(edgeWithAngleList[i].ID2)], edgeWithAngleList[i].fieldname);
        }

        //グラフの用意
        var graph_g = new Graph_G();
        graph_g.init(DOTNUMBER, EDGENUMBER, edges, dots);

        center_of_gravity(dots, WIDTH, HEIGHT);

        //温度パラメータが0以下になるまで安定状態を探索する
        while (true) {
            draw();
            if (t <= 0) break;
        }

        //fruchterman-Reingold法でエネルギーを最小化し、グラフを描画する
        function draw() {

            //各エッジの平均角度を求める
            for (var i = 0; i < caflist.length; i++) {
                var vectorSum: Vector_G = new Vector_G(0, 0);
                var edgeNum: number = 0;
                for (var j = 0; j < EDGENUMBER; j++) {
                    if (edgeIncludeCaF(edgeWithAngleList[j], caflist[i])) {
                        vectorSum = vectorSum.sum(edges[j].unitVector());
                        edgeNum += 1;
                    }
                }
                caflist[i].angle = vectorSum.angle();
            }

            //各点に働く力を計算
            focus_calculate(dots);

            //各点の速度から、次の座標を計算する
            for (var i = 0; i < DOTNUMBER; i++) {
                var dx: number = dots[i].dx;
                var dy: number = dots[i].dy;
                var disp: number = Math.sqrt(dx * dx + dy * dy);

                if (disp != 0) {
                    var d: number = Math.min(disp, t) / disp;
                    dots[i].x += dx * d;
                    dots[i].y += dy * d;
                }
            }

            //重心が画面の中央になるように調整する
            center_of_gravity(dots, WIDTH, HEIGHT);

            //温度パラメータを下げていく、0を下回ったら終了
            t -= dt;
            if (t <= 0) stopCalculate();
        }

        //計算を終了し、graphに座標情報を書きこんでいく
        function stopCalculate() {
            move_near_center(dots);
            //graph_g.drawForceVector();
            for (var i = 0; i < ObjectIDs.length; i++) {
                graph.setLocation(ObjectIDs[i], dots[i].x, dots[i].y);
            }
        }




        //点の初期配置に重なりが無いかを確かめる
        function sameDot_exists(dots: Dot_G[], dn: number): boolean {
            var bool: boolean = false;

            for (var i = 0; i < dn - 1; i++) {
                for (var j = i + 1; j < dn; j++) {
                    bool = bool || (dots[i].x == dots[j].x && dots[i].y == dots[j].y);
                }
            }
            return bool;
        }

        //２点間の引力を計算
        function f_a(r: number, K: number): number {
            return r * r / K;
        }

        //2点間の斥力を計算
        function f_r(r: number, K: number): number {
            return Math.pow(K, Knum) / Math.pow(r, rnum);
        }

        //各点の引力・斥力を計算し、Dot[]に代入していく
        function focus_calculate(dots: Dot_G[]) {

            //各点の速度・力ベクトルを0に初期化
            for (var i = 0; i < DOTNUMBER; i++) {
                dots[i].dx = 0;
                dots[i].dy = 0;
                dots[i].fax = 0;
                dots[i].fay = 0;
                dots[i].frx = 0;
                dots[i].fry = 0;
                dots[i].fmx = 0;
                dots[i].fmy = 0;
            }

            //各点の斥力を計算
            for (var i = 0; i < DOTNUMBER; i++) {
                for (var j = 0; j < DOTNUMBER; j++) {
                    if (j != i) {
                        var dx: number = dots[i].x - dots[j].x;
                        var dy: number = dots[i].y - dots[j].y;
                        var delta = Math.sqrt(dx * dx + dy * dy);
                        if (delta != 0) {
                            var d: number = f_r(delta, K) / delta;
                            dots[i].frx += dx * d;
                            dots[i].fry += dy * d;
                            //if (dddd[i * DOTNUMBER + j] < DOTNUMBER) {  //連結していれば
                            //    dots[i].frx += dx * d;
                            //    dots[i].fry += dy * d;
                            //} else {        //連結していなければ
                            //    var rate: number = delta < K * 3 ? K : -1;    //距離がK*3以上なら引力、未満なら斥力を発生させる
                            //    dots[i].frx += dx * rate / delta;
                            //    dots[i].fry += dy * rate / delta;
                            //}
                        }
                    }
                }
            }

            //各点の引力を計算
            for (var i = 0; i < EDGENUMBER; i++) {
                var dx: number = edges[i].dot1.x - edges[i].dot2.x;
                var dy: number = edges[i].dot1.y - edges[i].dot2.y;
                var delta: number = Math.sqrt(dx * dx + dy * dy);
                if (delta != 0) {
                    var d: number = f_a(delta, K) / delta;
                    var ddx: number = dx * d;
                    var ddy: number = dy * d;
                    edges[i].dot1.fax += -ddx;
                    edges[i].dot2.fax += +ddx;
                    edges[i].dot1.fay += -ddy;
                    edges[i].dot2.fay += +ddy;
                }
            }

            //各点の角度に基づいて働く力を計算
            for (var i = 0; i < EDGENUMBER; i++) {
                if (edgeWithAngleList[i].underforce == true) {
                    var angle: number = edges[i].angle();
                    for (var j = 0; j < caflist.length; j++) {
                        if (edgeIncludeCaF(edgeWithAngleList[i], caflist[j])) {
                            var dx: number = edges[i].dot2.x - edges[i].dot1.x;
                            var dy: number = edges[i].dot2.y - edges[i].dot1.y;
                            var delta: number = Math.sqrt(dx * dx + dy * dy);
                            if (delta != 0) {
                                var d: number = angle - caflist[j].angle; //弧度法から度数法に変更
                                var ddx: number;
                                var ddy: number;
                                var ex: number = KRAD * dy / delta;     //角度に関する力の基本ベクトル（元のベクトルを負の方向に90度回転）
                                var ey: number = - KRAD * dx / delta;   //角度に関する力の基本ベクトル（元のベクトルを負の方向に90度回転）
                                if (Math.abs(d) <= 180) {
                                    ddx = d * Math.abs(d) * ex;
                                    ddy = d * Math.abs(d) * ey;
                                } else {
                                    var dd: number = d + 2 * 180;
                                    if (d < 0) {
                                        ddx = dd * Math.abs(dd) * ex;
                                        ddy = dd * Math.abs(dd) * ey;
                                    } else {
                                        ddx = -dd * Math.abs(dd) * ex;
                                        ddy = -dd * Math.abs(dd) * ey;
                                    }
                                }
                                edges[i].dot1.fmx += -ddx;
                                edges[i].dot1.fmy += -ddy;
                                edges[i].dot2.fmx += ddx;
                                edges[i].dot2.fmy += ddy;
                            }
                        }
                    }
                }
            }

            //力ベクトルから速度を求める
            for (var i = 0; i < DOTNUMBER; i++) {
                dots[i].init_velocity();
            }
        }

        //ベクトルを画面に表示する
        function draw_vector(x: number, y: number, dx: number, dy: number) {
            var x1: number = x;
            var y1: number = y;
            var x2: number = x1 + dx;
            var y2: number = y1 + dy;
            var x3: number = x2 + (-dx - dy) / 12;
            var y3: number = y2 + (dx - dy) / 12;
            var x4: number = x2 + (-dx + dy) / 12;
            var y4: number = y2 + (-dx - dy) / 12;

            context.beginPath();
            context.moveTo(x1, y1);
            context.lineTo(x2, y2);
            context.stroke();

            context.beginPath();
            context.moveTo(x2, y2);
            context.lineTo(x3, y3);
            context.lineTo(x4, y4);
            context.closePath();
            context.fill();
        }

        //グラフの点集合の重心を求め、重心が画面の中心になるように点移動させる
        function center_of_gravity(dots: Dot_G[], width: number, height: number) {
            var cx: number = 0;
            var cy: number = 0;
            for (var i = 0; i < DOTNUMBER; i++) {
                cx += dots[i].x;
                cy += dots[i].y;
            }
            cx = cx / DOTNUMBER;        //重心のx座標
            cy = cy / DOTNUMBER;        //重心のy座標

            //重心が画面の中央になるように点移動させる
            var dx: number = width / 2 - cx;
            var dy: number = height / 2 - cy;
            for (var i = 0; i < DOTNUMBER; i++) {
                dots[i].x += dx;
                dots[i].y += dy;
            }
        }

        //計算後に連結していないノード同士が離れすぎていないように、グループ毎に全体の重心に近づけていく
        function move_near_center(dots: Dot_G[]) {
            var cx: number = 0;
            var cy: number = 0;
            for (var i = 0; i < DOTNUMBER; i++) {
                cx += dots[i].x;
                cy += dots[i].y;
            }
            cx = cx / DOTNUMBER;        //重心のx座標
            cy = cy / DOTNUMBER;        //重心のy座標

            var darray: number[] = new Array(DOTNUMBER);
            for (var i = 0; i < DOTNUMBER; i++) {
                darray[i] = 1;      //初期化
            }

            var groupArray: number[][] = new Array();

            for (var i = 0; i < DOTNUMBER; i++) {
                if (darray[i] != -1) {
                    var ary: number[] = new Array();
                    ary.push(i);
                    darray[i] = -1;
                    for (j = i + 1; j < DOTNUMBER; j++) {
                        if (dddd[i * DOTNUMBER + j] != DOTNUMBER) {
                            ary.push(j);
                            darray[j] = -1;
                        }
                    }
                    groupArray.push(ary);
                }
            }

            var groupCenter: number[] = new Array(groupArray.length);
            for (var i = 0; i < groupArray.length; i++) {
                var cnx: number = 0;
                var cny: number = 0;
                for (var j = 0; j < groupArray[i].length; j++) {
                    cnx += dots[groupArray[i][j]].x;
                    cny += dots[groupArray[i][j]].y;
                }
                cnx = cnx / groupArray[i].length;       //連結しているグループの重心
                cny = cny / groupArray[i].length;

                var defx: number = cnx - cx;        //全体の重心とグループの重心の差
                var defy: number = cny - cy;
                var def: number = Math.sqrt(defx * defx + defy * defy);

                if (def != 0) {
                    var movex: number = (def - K * Math.sqrt(groupArray[i].length)) * defx / def;
                    var movey: number = (def - K * Math.sqrt(groupArray[i].length)) * defy / def;

                    for (var j = 0; j < groupArray[i].length; j++) {
                        dots[groupArray[i][j]].x -= movex;
                        dots[groupArray[i][j]].y -= movey;
                    }
                }
            }
        }

        //各点同士の最短経路長を求める
        function FloydWarshall(dotnumber: number, edgenumber: number, d: number[]) {
            for (var i = 0; i < dotnumber; i++) {
                for (var j = 0; j < dotnumber; j++) {
                    d[i * dotnumber + j] = dotnumber;
                }
                d[i * dotnumber + i] = 0;
            }
            for (var i = 0; i < edgenumber; i++) {
                var one: number = ObjectIDs.indexOf(edgeWithAngleList[i].ID1);
                var two: number = ObjectIDs.indexOf(edgeWithAngleList[i].ID2);
                d[one * dotnumber + two] = 1;
                d[two * dotnumber + one] = 1;
            }
            for (var k = 0; k < dotnumber; k++) {
                for (var i = 0; i < dotnumber; i++) {
                    for (var j = 0; j < dotnumber; j++) {
                        if (d[i * dotnumber + j] > d[i * dotnumber + k] + d[k * dotnumber + j]) {
                            d[i * dotnumber + j] = d[i * dotnumber + k] + d[k * dotnumber + j];
                        }
                    }
                }
            }
        }
    }





    /**************
     * 実行部分
     * ************/

    //オブジェクトがグラフ構造か木構造かを判別して描画するか否な
    //falseにすると、すべてを循環の無い木構造と見なして描画する
    var DrawCircle: boolean = true;

    //参照先がprimitive型のときに角度を決定するかどうか
    var EdgeWithPrimitiveValue: boolean = true;

    var edgeListInitStartTime = performance.now();
    //角度付きエッジリストを用意し、参照関係を元に初期化する
    var edgeWithAngleList: EdgeWithAngle[] = new Array();
    var classAndFieldList: ClassAndField[] = new Array();
    edgeListInit(graph, edgeWithAngleList, classAndFieldList, DrawCircle, EdgeWithPrimitiveValue);
    var edgeListInitEndTime = performance.now();
    console.log("edgeListInit Time = " + (edgeListInitEndTime - edgeListInitStartTime) + " ms");
    //console.log("edgeList = ");
    //console.log(edgeWithAngleList);
    //console.log("cafList = ");
    //console.log(classAndFieldList);

    var forceDirectedMethodStartTime = performance.now();
    //角度付きエッジリストを元に、力学的手法を用いて各ノードの座標を計算
    //graphオブジェクト内のノード座標を破壊的に書き替える
    calculateLocationWithForceDirectedMethod(graph, edgeWithAngleList, classAndFieldList);
    var forceDirectedMethodEndTime = performance.now();
    console.log("forceDirectedMethod Time = " + (forceDirectedMethodEndTime - forceDirectedMethodStartTime) + " ms");
}