function getRandomNumber() {
    return Math.floor(Math.random() * 20) + 1;
}

function addIndefiniteArticle(word) {
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    const firstLetter = word[0].toLowerCase();

    if (vowels.includes(firstLetter)) {
        return 'an-' + word;
    } else {
        return 'a-' + word;
    }
}

const process = {
    /**
     * @name processMethods
     * @description [descripción de la funcion]
     * @return {void}
     */
    processMethods: function (methods, services, transformString, properties) {
        let isTimeout = false;

        let keys = Object.keys(methods);

        let templateMethod = keys
            .map((key) => {
                /**
              it('should run ngOnInit as expected', (done) => {
                // consts
                const account: Account = {} as any;

                // setup
                (appDataService as any).currentAccount.next(account);

                // spys
                spyOn(component as any, 'getSharesCount');

                // test
                component.ngOnInit();

                // outcomes
                appDataService.currentAccount$.pipe(take(1)).subscribe(() => {
                expect(component.currentAccount).toStrictEqual(account);
                expect((component as any).getSharesCount).toHaveBeenCalledTimes(1);
                done();
                });
            });
            
             */

                const methodName = key;
                const methodContent = methods[key].code;
                const params = methods[key].parameters;
                const returnType = methods[key].returnType;

                // validamos los setTimeout

                let isTimeoutMethod = methodContent.includes('setTimeout');

                if (!isTimeout && isTimeoutMethod) {
                    isTimeout = true;
                }

                // validamos las asignaciones a la clase
                const regexProperties = new RegExp(
                    `this\\s*\\.\\s*(\\w+)\\s*\\=\\s*(!||\\w+)*\\.*(\\w+)`,
                    'gmi'
                );
                5;

                let matchesProperties = methodContent.match(regexProperties);
                let templateProperties = ``;
                let templateOutcomesProperties = ``;

                if (matchesProperties) {
                    console.log(matchesProperties);

                    matchesProperties.forEach((p) => {
                        const prop = p
                            .replace('this.', '')
                            .split('=')
                            .map((x) => x.trim());
                        let type = properties[prop[0]];
                        let attr = prop[0];
                        let name = prop[1];

                        if (!type) {
                            type = properties['_' + prop[0]];
                            attr = '_' + attr;
                        }

                        templateProperties += `const ${attr}Expected: ${type} = ${this.generateParamValue(
                            {
                                type: type,
                                name: name,
                            }
                        )};
    `;

                        if (['boolean', 'number'].includes(type)) {
                            templateOutcomesProperties += `expect(component['${attr}']).toBe(${attr}Expected);
    `;
                        } else {
                            templateOutcomesProperties += `expect(component['${attr}']).toStrictEqual(${attr}Expected);
    `;
                        }
                    });
                }

                let template = `it('should run ${methodName} as expected', ${
                    isTimeoutMethod ? 'fakeAsync(' : ''
                }() => {`;

                if (params.length || templateProperties.length) {
                    template += `
    // consts
    ${templateProperties}`;

                    params.forEach((p) => {
                        template += `const ${p.name}: ${
                            p.type
                        } = ${this.generateParamValue(p)};
    `;
                    });
                }

                // spy
                let spys = keys.filter(
                    (m) => m != key && methodContent.includes(m)
                );
                if (spys.length) {
                    template += `
    // spy
    `;
                    spys.forEach(
                        (m) =>
                            (template += `spyOn(component as any, '${m}');
    `)
                    );
                }

                let spysServices = services.filter((s) =>
                    methodContent.includes(s.name)
                );

                let toHaveBeenCalledTimes = [];
                let toHaveBeenCalledWith = [];

                if (spysServices.length) {
                    if (!spys.length) {
                        template += `
    // spy
    `;
                    }

                    spysServices.forEach((s) => {
                        let service = s.name;
                        const regex = new RegExp(
                            `(${service})\\s*\\.(\\w+)\\(`,
                            'g'
                        );

                        let matches = regex.exec(methodContent);

                        if (!matches) {
                            template += `/** Method no found **/
    spyOn(${service}, 'Insert the method name');
    `;
                        }

                        if (matches && matches.length == 3) {
                            template += `spyOn(${service}, '${matches[2]}');
    `;

                            //buscamos si el servicio NO tiene parametros
                            const regexParams = new RegExp(
                                `(${matches[0].replace('(', '')})\\(\\)`,
                                'g'
                            );

                            let matchesParams = regexParams.exec(methodContent);
                            if (matchesParams) {
                                toHaveBeenCalledTimes.push({
                                    service: s,
                                    matches,
                                });
                            } else {
                                //buscamos los parametros del servicio
                                const regexParamsFound = new RegExp(
                                    `(${matches[1]})\\s*\\.(\\w+)\\((.|\\s)[^\\)]+`,
                                    'g'
                                );

                                let matchesParamsFound =
                                    regexParamsFound.exec(methodContent);

                                if (matchesParamsFound) {
                                    let param = matchesParamsFound[0]
                                        .replace(matches[0], '')
                                        .replace(/this\./gim, 'component.')
                                        .trim();

                                    toHaveBeenCalledWith.push({
                                        service: s,
                                        matches,
                                        matchesParamsFound,
                                        param: param.includes('(')
                                            ? `/*${param}*/`
                                            : param,
                                    });
                                } else {
                                }
                            }
                        }
                    });
                }

                // buscamos los emit
                const regexEmit = new RegExp(
                    `this\\s*\\.\\s*(\\w+)\\s*\\.?emit\\(`,
                    'gmi'
                );

                let matchesEmit = methodContent.match(regexEmit);

                if (matchesEmit) {
                    if (!spys.length && !spysServices.length) {
                        template += `
    // spy
    `;
                    }
                    matchesEmit.forEach((emitter) => {
                        const emitterName = emitter
                            .replace('(', '')
                            .replace('.emit', '')
                            .replace('this.', '');

                        template += `spyOn(component['${emitterName}'], 'emit');
    `;

                        //buscamos si el metodo NO tiene parametros
                        const regexParams = new RegExp(
                            `(${emitter.replace('(', '')})\\(\\)`,
                            'g'
                        );

                        let matchesEmitParams = regexParams.exec(methodContent);
                        if (matchesEmitParams) {
                            toHaveBeenCalledTimes.push({
                                emit: emitterName,
                                matchesEmit,
                            });
                        } else {
                            let regexString = `(${emitter.replace(
                                '(',
                                ''
                            )})\\((.|\\s)[^\\)]+`;

                            //buscamos los parametros del metodo
                            const regexParamsFound = new RegExp(
                                regexString,
                                'g'
                            );

                            let matchesEmitParamsFound =
                                regexParamsFound.exec(methodContent);

                            if (matchesEmitParamsFound) {
                                let param = matchesEmitParamsFound[0]
                                    .replace(emitter, '')
                                    .replace(/this\./gim, 'component.')
                                    .trim();

                                toHaveBeenCalledWith.push({
                                    emit: emitterName,
                                    param: param.includes('(')
                                        ? `/*${param}*/`
                                        : param,
                                });
                            }
                        }
                    });
                }

                if (key == 'ngOnDestroy') {
                    if (
                        !spys.length &&
                        !spysServices.length &&
                        !matchesEmit.length
                    ) {
                        template += `
// spy
`;
                    }

                    if (methodContent.includes('subscriptions.unsubscribe')) {
                        template += `spyOn(component['subscriptions'], 'unsubscribe');
                    `;
                    }
                }

                // outcomes component
                spys.forEach((m) => {
                    let method = m;
                    const regex = new RegExp(
                        `(${method})\\s*\\.*(\\w+)*\\(`,
                        'g'
                    );

                    let matches = regex.exec(methodContent);

                    if (matches && matches.length == 3) {
                        //buscamos si el metodo NO tiene parametros
                        const regexParams = new RegExp(
                            `(${matches[0].replace('(', '')})\\(\\)`,
                            'g'
                        );

                        let matchesParams = regexParams.exec(methodContent);
                        if (matchesParams) {
                            toHaveBeenCalledTimes.push({
                                method: m,
                                matches,
                            });
                        } else {
                            //buscamos los parametros del metodo
                            const regexParamsFound = new RegExp(
                                `(${matches[1]})\\s*\\.*(\\w+)*\\((.|\\s)[^\\)]+`,
                                'g'
                            );

                            let matchesParamsFound =
                                regexParamsFound.exec(methodContent);

                            if (matchesParamsFound) {
                                let param = matchesParamsFound[0]
                                    .replace(matches[0], '')
                                    .replace(/this\./gim, 'component.')
                                    .trim();

                                toHaveBeenCalledWith.push({
                                    method: m,
                                    matches,
                                    matchesParamsFound,
                                    param: param.includes('(')
                                        ? `/*${param}*/`
                                        : param,
                                });
                            }
                        }
                    }
                });

                if (returnType != 'void') {
                    template += `const expectedResult: ${returnType} = ${this.generateParamValue(
                        {
                            type: returnType,
                            name: 'expectedResult',
                        }
                    )}
    `;
                }

                // test
                template += `
    // test
    `;

                if (returnType != 'void') {
                    template += `const result: ${returnType} = `;
                }

                let parameters = params.length
                    ? params.map((p) => p.name).join(', ')
                    : '';

                if (methodContent.includes('private')) {
                    template += `component['${methodName}'](${parameters});
    `;
                } else {
                    template += `component.${methodName}(${parameters});
    `;
                }

                if (isTimeoutMethod) {
                    template += `tick(100);
    `;
                }

                let isDetectorRefChanges =
                    methodContent.includes('.detectChanges()');

                // outcomes
                template += `
    // outcomes
    ${templateOutcomesProperties}`;

                if (returnType != 'void') {
                    template += `expect(result).toStrictEqual(expectedResult);
`;
                }
                if (isDetectorRefChanges) {
                    template += `expect(changeDetectorRef.detectChanges).toHaveBeenCalledTimes(1);
                    `;
                }

                // toHaveBeenCalledTimes
                if (toHaveBeenCalledTimes.length) {
                    toHaveBeenCalledTimes.forEach((data) => {
                        if (data.emit) {
                            template += `expect(component['${data.emit}'].emit).toHaveBeenCalledTimes(1);
                            `;
                        } else {
                            template += `expect(${
                                data.method ? 'component' : data.service.name
                            }.${
                                data.method
                                    ? data.method
                                    : data.matches
                                    ? data.matches[2]
                                    : 'SOME_METHOD'
                            }).toHaveBeenCalledTimes(1);
    `;
                        }
                    });
                }

                // toHaveBeenCalledWith
                if (toHaveBeenCalledWith.length) {
                    toHaveBeenCalledWith.forEach((data) => {
                        if (data.emit) {
                            template += `expect(component['${data.emit}'].emit).toHaveBeenCalledWith(${data.param});
    `;
                        } else {
                            template += `expect(${
                                data.method ? 'component' : data.service.name
                            }.${
                                data.method
                                    ? data.method
                                    : data.matches
                                    ? data.matches[2]
                                    : 'SOME_METHOD'
                            }).toHaveBeenCalledWith(${data.param});
    `;
                        }
                    });
                }

                if (key == 'ngOnDestroy') {
                    if (methodContent.includes('subscriptions.unsubscribe')) {
                        template += `expect(component['subscriptions'].unsubscribe).toHaveBeenCalledTimes(1);;
                    `;
                    }
                }

                // end

                template += `
  }) ${isTimeoutMethod ? ')' : ''};
            
  `;

                return template;
            })
            .join('');

        return {
            template: templateMethod,
            isTimeout,
        };
    },

    /**
     * @name generateParamValue
     * @description [descripción de la funcion]
     * @return {void}
     */
    generateParamValue: function (param) {
        if (param.type == 'number[]') {
            return `[${getRandomNumber()}, ${getRandomNumber()}, ${getRandomNumber()}, ${getRandomNumber()}]`;
        }

        if (param.type == 'number') {
            return getRandomNumber();
        }

        if (param.type == 'string[]') {
            return `['${addIndefiniteArticle(
                param.name
            )}-1', '${addIndefiniteArticle(
                param.name
            )}-2', '${addIndefiniteArticle(param.name)}-3']`;
        }

        if (param.type == 'string') {
            return `'${addIndefiniteArticle(param.name)}'`;
        }

        if (param.type == 'boolean[]') {
            return `[true, false, true]`;
        }

        if (param.type == 'boolean') {
            return `true`;
        }

        if (param.type.includes('[]')) {
            return `[] as ${param.type}`;
        }

        return `{} as ${param.type}`;
    },
};

module.exports = process;
