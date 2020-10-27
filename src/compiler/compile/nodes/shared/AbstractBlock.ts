import Block from '../../render_dom/Block';
import Component from '../../Component';
import Node from './Node';
import { INode } from '../interfaces';

export default class AbstractBlock extends Node {
	block: Block;
	children: INode[];

	constructor(component: Component, parent, scope, info: any) {
		super(component, parent, scope, info);
	}
}
